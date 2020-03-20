package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/replicatedhq/kotsadm/pkg/logger"
	v1 "github.com/vmware-tanzu/velero/pkg/apis/velero/v1"
	velerov1 "github.com/vmware-tanzu/velero/pkg/generated/clientset/versioned/typed/velero/v1"
	"github.com/vmware-tanzu/velero/pkg/label"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/rest"
)

func DownloadSnapshotLogs(w http.ResponseWriter, r *http.Request) {
	println("here here")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "content-type, origin, accept, authorization")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if err := requireValidSession(w, r); err != nil {
		// header already written on error
		logger.Error(err)
		return
	}

	config, err := rest.InClusterConfig()
	if err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}
	velero, err := velerov1.NewForConfig(config)
	if err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}

	namespace := "velero" // TODO support alternative namespaces
	backupName := mux.Vars(r)["backup"]
	drName := fmt.Sprintf("backup-%s-%d", backupName, time.Now().Unix())
	drName = label.GetValidName(drName)
	dr := &v1.DownloadRequest{
		ObjectMeta: metav1.ObjectMeta{
			Name: drName,
		},
		Spec: v1.DownloadRequestSpec{
			Target: v1.DownloadTarget{
				Kind: "BackupLog",
				Name: backupName,
			},
		},
	}

	_, err = velero.DownloadRequests(namespace).Create(dr)
	if err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}

	signedURL := ""
	watcher, err := velero.DownloadRequests(namespace).Watch(metav1.ListOptions{})
	if err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}
	defer watcher.Stop()
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	for {
		if signedURL != "" {
			break
		}
		select {
		case <-ctx.Done():
			logger.Error(ctx.Err())
			w.WriteHeader(500)
			return
		case e := <-watcher.ResultChan():
			if e.Type != watch.Modified {
				continue
			}
			dr, ok := e.Object.(*v1.DownloadRequest)
			if !ok {
				continue
			}
			if dr.Name != drName {
				continue
			}
			if dr.Status.DownloadURL != "" {
				signedURL = dr.Status.DownloadURL
				break
			}
		}
	}
	if err := velero.DownloadRequests(namespace).Delete(drName, &metav1.DeleteOptions{}); err != nil {
		logger.Error(err)
		// continue
	}

	resp, err := http.Get(signedURL)
	if err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Disposition", "attachment; filename=backup-logs.tar.gz")
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Length", resp.Header.Get("Content-Length"))

	_, err = io.Copy(w, resp.Body)
	if err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}
}
