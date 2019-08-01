package updateworker

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"os"

	"github.com/pkg/errors"
	"github.com/replicatedhq/ship-cluster/worker/pkg/pullrequest"
	"github.com/replicatedhq/ship-cluster/worker/pkg/types"
	"github.com/replicatedhq/ship/pkg/state"
	"go.uber.org/zap"
	"gopkg.in/yaml.v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (w *Worker) postUpdateActions(watchID string, parentWatchID *string, parentSequence *int, sequence int, s3Filepath string) error {
	watch, err := w.Store.GetWatch(context.TODO(), watchID)
	if err != nil {
		return errors.Wrap(err, "get watch")
	}

	archive, err := w.fetchArchiveFromS3(watchID, s3Filepath)
	if err != nil {
		return errors.Wrap(err, "fetch archive")
	}
	defer os.Remove(archive.Name())

	if err := w.extractCollectorSpec(archive); err != nil {
		return errors.Wrap(err, "extract collector spec")
	}

	if err := w.triggerIntegrations(watch, sequence, archive, parentSequence); err != nil {
		return errors.Wrap(err, "trigger integraitons")
	}

	downstreamWatchIDs, err := w.Store.ListDownstreamWatchIDs(context.TODO(), watchID)
	if err != nil {
		w.Logger.Errorw("updateworker post update actions unable to get downstream watch ids", zap.String("watchID", watchID), zap.Error(err))
		return err
	}
	for _, downstreamWatchID := range downstreamWatchIDs {
		if err := w.Store.CreateWatchUpdate(context.TODO(), downstreamWatchID, &sequence); err != nil {
			w.Logger.Errorw("updateworker post update actions unable to create downstream watch update", zap.String("watchID", watchID), zap.Error(err))
			return err
		}
	}

	return nil
}

func (w *Worker) fetchArchiveFromS3(watchID string, s3Filepath string) (*os.File, error) {
	filename, err := w.Store.DownloadFromS3(context.TODO(), s3Filepath)
	if err != nil {
		return nil, errors.Wrap(err, "download")
	}

	archive, err := os.Open(filename)
	if err != nil {
		return nil, errors.Wrap(err, "open")
	}

	return archive, nil
}

func (w *Worker) triggerIntegrations(watch *types.Watch, sequence int, archive *os.File, parentSequence *int) error {
	cluster, err := w.Store.GetClusterForWatch(context.TODO(), watch.ID)
	if err != nil {
		return errors.Wrap(err, "get cluster for watch")
	}

	prNumber, commitSHA, versionStatus, branchName, err := w.maybeCreatePullRequest(watch, cluster, archive)
	if err != nil {
		return errors.Wrap(err, "maybe create pull request")
	}

	isCurrent := cluster == nil

	if err := w.createVersion(watch, sequence, archive, versionStatus, branchName, prNumber, commitSHA, isCurrent, parentSequence); err != nil {
		return errors.Wrap(err, "create version")
	}

	return nil
}

func (w *Worker) maybeCreatePullRequest(watch *types.Watch, cluster *types.Cluster, file multipart.File) (int, string, string, string, error) {
	file.Seek(0, io.SeekStart)

	// midstreams won't have a cluster
	if cluster == nil {
		return 0, "", "deployed", "", nil
	}

	// ship clusters don't need PRs
	if cluster.Type != "gitops" {
		return 0, "", "pending", "", nil
	}

	watchState := state.State{}
	if err := json.Unmarshal([]byte(watch.StateJSON), &watchState); err != nil {
		return 0, "", "", "", errors.Wrap(err, "unmarshal watch state")
	}

	previousWatchVersion, err := w.Store.GetMostRecentWatchVersion(context.TODO(), watch.ID)
	if err != nil {
		return 0, "", "", "", errors.Wrap(err, "getMostRecentPullRequestCreated")
	}

	sourceBranch := ""
	if pullrequest.ShouldUsePreviousBranch(previousWatchVersion) {
		sourceBranch = previousWatchVersion.SourceBranch
	}

	updatePRTitle := fmt.Sprintf("Update %s with edits made in Replicated Ship", watch.Title)

	githubPath, err := w.Store.GetGitHubPathForClusterWatch(context.TODO(), cluster.ID, watch.ID)
	if err != nil {
		return 0, "", "", "", err
	}

	prRequest, err := pullrequest.NewPullRequestRequest(watch, file, cluster.GitHubOwner, cluster.GitHubRepo, cluster.GitHubBranch, githubPath, cluster.GitHubInstallationID, watchState, updatePRTitle, sourceBranch)
	if err != nil {
		return 0, "", "", "", errors.Wrap(err, "new pull request request")
	}

	prNumber, commitSHA, branchName, err := pullrequest.CreatePullRequest(w.Logger, w.Config.GithubPrivateKey, w.Config.GithubIntegrationID, prRequest)
	if err != nil {
		return 0, "", "", "", errors.Wrap(err, "create pull request")
	}

	return prNumber, commitSHA, "pending", branchName, nil
}

func (w *Worker) createVersion(watch *types.Watch, sequence int, file multipart.File, versionStatus string, branchName string, prNumber int, commitSHA string, isCurrent bool, parentSequence *int) error {
	versionLabel := "Unknown"

	if parentSequence != nil {
		// downstream watches should use the parent version label
		parentWatchID, err := w.Store.GetParentWatchID(context.TODO(), watch.ID)
		if err != nil {
			return errors.Wrap(err, "get parent watch id")
		}

		if parentWatchID == nil {
			return fmt.Errorf("unable to create version with parent sequence but no parent watch: %s", watch.ID)
		}

		currentVersion, err := w.Store.GetOneWatchVersion(context.TODO(), *parentWatchID, *parentSequence)
		if err != nil {
			return errors.Wrap(err, "get one watch version")
		}

		versionLabel = currentVersion.VersionLabel
	} else {
		watchState := state.State{}
		if err := json.Unmarshal([]byte(watch.StateJSON), &watchState); err != nil {
			return errors.Wrap(err, "unmarshal watch state")
		}

		if watchState.V1 != nil && watchState.V1.Metadata != nil && watchState.V1.Metadata.Version != "" {
			versionLabel = watchState.V1.Metadata.Version
		} else {
			// Hmmm...
			previousWatchVersion, err := w.Store.GetMostRecentWatchVersion(context.TODO(), watch.ID)
			if err != nil {
				return errors.Wrap(err, "get most recent watch version")
			}

			versionLabel = previousWatchVersion.VersionLabel
		}
	}

	err := w.Store.CreateWatchVersion(context.TODO(), watch.ID, versionLabel, versionStatus, branchName, sequence, prNumber, commitSHA, isCurrent, parentSequence)
	if err != nil {
		return errors.Wrap(err, "create watch version")
	}

	return nil
}

func (w *Worker) extractCollectorSpec(archive *os.File) error {
	_, err := archive.Seek(0, io.SeekStart)
	if err != nil {
		return errors.Wrap(err, "seek archive")
	}

	gzReader, err := gzip.NewReader(archive)
	if err != nil {
		return err
	}

	tarReader := tar.NewReader(gzReader)
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return errors.Wrap(err, "read archive")
		}

		switch header.Typeflag {
		case tar.TypeReg:
			contents, err := ioutil.ReadAll(tarReader)
			if err != nil {
				return errors.Wrap(err, "read file from archive")
			}

			gvk := metav1.GroupVersionKind{}
			if err := yaml.Unmarshal(contents, &gvk); err != nil {
				continue
			}

			if gvk.Group != "troubleshoot.replicated.com" || gvk.Version != "v1beta1" || gvk.Kind != "Collector" {
				continue
			}

			if err := w.Store.SetWatchTroubleshootCollectors(context.TODO(), updateSession.WatchID, contents); err != nil {
				return errors.Wrap(err, "set troubleshoot collectors")
			}

		default:
			if _, err := ioutil.ReadAll(tarReader); err != nil {
				return errors.Wrap(err, "read non-file from archive")
			}
		}
	}

	return nil
}
