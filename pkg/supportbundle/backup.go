package supportbundle

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/mholt/archiver"
	"github.com/pkg/errors"
	"github.com/replicatedhq/kotsadm/pkg/logger"
	"github.com/replicatedhq/kotsadm/pkg/redact"
	troubleshootanalyze "github.com/replicatedhq/troubleshoot/pkg/analyze"
	troubleshootv1beta1 "github.com/replicatedhq/troubleshoot/pkg/apis/troubleshoot/v1beta1"
	troubleshootcollect "github.com/replicatedhq/troubleshoot/pkg/collect"
	"github.com/replicatedhq/troubleshoot/pkg/convert"
	troubleshootversion "github.com/replicatedhq/troubleshoot/pkg/version"
	"go.uber.org/zap"
	"gopkg.in/yaml.v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
)

func CreateBundleForBackup(appID string, backupName string, backupNamespace string) (string, error) {
	logger.Debug("executing support bundle for backup",
		zap.String("backupName", backupName),
		zap.String("backupNamespace", backupNamespace))

	progressChan := make(chan interface{}, 0)
	defer close(progressChan)

	go func() {
		for {
			msg, ok := <-progressChan
			if ok {
				logger.Debugf("%v", msg)
			} else {
				return
			}
		}
	}()

	restConfig, err := rest.InClusterConfig()
	if err != nil {
		return "", errors.Wrap(err, "failed to read in cluster config")
	}

	var collectors troubleshootcollect.Collectors
	collectors = append(collectors, &troubleshootcollect.Collector{
		Collect: &troubleshootv1beta1.Collect{
			Logs: &troubleshootv1beta1.Logs{
				CollectorMeta: troubleshootv1beta1.CollectorMeta{
					CollectorName: "velero",
				},
				Name:      "velero",
				Namespace: backupNamespace,
				Selector: []string{
					"component=velero",
					"deploy=velero",
					"app.kubernetes.io/name=velero",
				},
			},
		},
		Redact:       true,
		ClientConfig: restConfig,
		Namespace:    backupNamespace,
	})
	collectors = append(collectors, &troubleshootcollect.Collector{
		Collect: &troubleshootv1beta1.Collect{
			Logs: &troubleshootv1beta1.Logs{
				CollectorMeta: troubleshootv1beta1.CollectorMeta{
					CollectorName: "restic",
				},
				Name:      "restic",
				Namespace: backupNamespace,
				Selector: []string{
					"component=velero",
					"name=restic",
					"app.kubernetes.io/name=velero",
				},
			},
		},
		Redact:       true,
		ClientConfig: restConfig,
		Namespace:    backupNamespace,
	})

	// make a temp file to store the bundle in
	bundlePath, err := ioutil.TempDir("", "troubleshoot")
	if err != nil {
		return "", errors.Wrap(err, "failed to create temp dir")
	}
	defer os.RemoveAll(bundlePath)

	if err = writeVersionFile(bundlePath); err != nil {
		return "", errors.Wrap(err, "failed to write version file")
	}

	redacts := []*troubleshootv1beta1.Redact{}
	globalRedact, err := redact.GetRedact()
	if err == nil && globalRedact != nil {
		redacts = globalRedact.Spec.Redactors
	} else if err != nil {
		return "", errors.Wrap(err, "failed to get global redactors")
	}

	// Run preflights collectors synchronously
	for _, collector := range collectors {
		if len(collector.RBACErrors) > 0 {
			// don't skip clusterResources collector due to RBAC issues
			if collector.Collect.ClusterResources == nil {
				progressChan <- fmt.Sprintf("skipping collector %s with insufficient RBAC permissions", collector.GetDisplayName())
				continue
			}
		}

		progressChan <- collector.GetDisplayName()

		result, err := collector.RunCollectorSync(redacts)
		if err != nil {
			progressChan <- fmt.Errorf("failed to run collector %q: %v", collector.GetDisplayName(), err)
			continue
		}

		if result != nil {
			err = saveCollectorOutput(result, bundlePath)
			if err != nil {
				progressChan <- fmt.Errorf("failed to parse collector spec %q: %v", collector.GetDisplayName(), err)
				continue
			}
		}
	}

	// create an archive of this bundle
	supportBundleArchivePath, err := ioutil.TempDir("", "kotsadm")
	if err != nil {
		return "", errors.Wrap(err, "failed to create archive dir")
	}
	defer os.RemoveAll(supportBundleArchivePath)

	if err = tarSupportBundleDir(bundlePath, filepath.Join(supportBundleArchivePath, "support-bundle.tar.gz")); err != nil {
		return "", errors.Wrap(err, "failed to create support bundle archive")
	}

	// we have a support bundle...
	// store it
	supportBundle, err := CreateBundle(
		fmt.Sprintf("backup-%s", backupName),
		appID,
		filepath.Join(supportBundleArchivePath, "support-bundle.tar.gz"))
	if err != nil {
		return "", errors.Wrap(err, "failed to create support bundle")
	}

	// analyze it
	analyzers := []*troubleshootv1beta1.Analyze{}

	analyzers = append(analyzers, &troubleshootv1beta1.Analyze{
		TextAnalyze: &troubleshootv1beta1.TextAnalyze{
			AnalyzeMeta: troubleshootv1beta1.AnalyzeMeta{
				CheckName: "Velero Errors",
			},
			CollectorName: "velero",
			FileName:      "velero/velero*/velero.log",
			RegexPattern:  "level=error",
			Outcomes: []*troubleshootv1beta1.Outcome{
				{
					Fail: &troubleshootv1beta1.SingleOutcome{
						Message: "Velero has errors",
					},
					Pass: &troubleshootv1beta1.SingleOutcome{
						Message: "Velero does not have errors",
					},
				},
			},
		},
	})
	analyzers = append(analyzers, &troubleshootv1beta1.Analyze{
		TextAnalyze: &troubleshootv1beta1.TextAnalyze{
			AnalyzeMeta: troubleshootv1beta1.AnalyzeMeta{
				CheckName: "Restic Volumes",
			},
			CollectorName: "restic",
			FileName:      "restic/*.log",
			RegexPattern:  "expected one matching path, got 0",
			Outcomes: []*troubleshootv1beta1.Outcome{
				{
					Fail: &troubleshootv1beta1.SingleOutcome{
						Message: "Restic volume error",
					},
					Pass: &troubleshootv1beta1.SingleOutcome{
						Message: "No restic volume error",
					},
				},
			},
		},
	})

	analyzer := troubleshootv1beta1.Analyzer{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "troubleshoot.replicated.com/v1beta1",
			Kind:       "Analyzer",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: backupName,
		},
		Spec: troubleshootv1beta1.AnalyzerSpec{
			Analyzers: analyzers,
		},
	}
	b, err := json.Marshal(analyzer)
	if err != nil {
		return "", errors.Wrap(err, "failed to marshal analyzers")
	}

	analyzeResult, err := troubleshootanalyze.DownloadAndAnalyze(filepath.Join(supportBundleArchivePath, "support-bundle.tar.gz"), string(b))
	if err != nil {
		return "", errors.Wrap(err, "failed to analyze")
	}

	data := convert.FromAnalyzerResult(analyzeResult)
	insights, err := json.MarshalIndent(data, "", "    ")
	if err != nil {
		return "", errors.Wrap(err, "failed to marshal analysis")
	}

	if err := SetBundleAnalysis(supportBundle.ID, insights); err != nil {
		return "", errors.Wrap(err, "failed to update bundle status")
	}
	return supportBundle.ID, nil
}

func tarSupportBundleDir(inputDir string, outputFilename string) error {
	tarGz := archiver.TarGz{
		Tar: &archiver.Tar{
			ImplicitTopLevelFolder: false,
		},
	}

	paths := []string{
		filepath.Join(inputDir, "version.yaml"), // version file should be first in tar archive for quick extraction
	}

	topLevelFiles, err := ioutil.ReadDir(inputDir)
	if err != nil {
		return errors.Wrap(err, "failed to list bundle directory contents")
	}
	for _, f := range topLevelFiles {
		if f.Name() == "version.yaml" {
			continue
		}
		paths = append(paths, filepath.Join(inputDir, f.Name()))
	}

	if err := tarGz.Archive(paths, outputFilename); err != nil {
		return errors.Wrap(err, "failed to create archive")
	}

	return nil
}

func saveCollectorOutput(output map[string][]byte, bundlePath string) error {
	for filename, maybeContents := range output {
		fileDir, fileName := filepath.Split(filename)
		outPath := filepath.Join(bundlePath, fileDir)

		if err := os.MkdirAll(outPath, 0777); err != nil {
			return errors.Wrap(err, "failed to create output file")
		}

		if err := ioutil.WriteFile(filepath.Join(outPath, fileName), maybeContents, 0644); err != nil {
			return errors.Wrap(err, "failed to write file")
		}
	}

	return nil
}

func writeVersionFile(path string) error {
	version := troubleshootv1beta1.SupportBundleVersion{
		ApiVersion: "troubleshoot.replicated.com/v1beta1",
		Kind:       "SupportBundle",
		Spec: troubleshootv1beta1.SupportBundleVersionSpec{
			VersionNumber: troubleshootversion.Version(),
		},
	}
	b, err := yaml.Marshal(version)
	if err != nil {
		return err
	}

	filename := filepath.Join(path, "version.yaml")
	err = ioutil.WriteFile(filename, b, 0644)
	if err != nil {
		return err
	}

	return nil
}
