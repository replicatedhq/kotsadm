package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/replicatedhq/kotsadm/pkg/app"
	"github.com/replicatedhq/kotsadm/pkg/logger"
	"github.com/replicatedhq/kotsadm/pkg/session"
	"github.com/replicatedhq/kotsadm/pkg/snapshot"
	snapshottypes "github.com/replicatedhq/kotsadm/pkg/snapshot/types"
)

type CreateBackupRequest struct {
}

type CreateBackupResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func CreateBackup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "content-type, origin, accept, authorization")

	if r.Method == "OPTIONS" {
		w.WriteHeader(200)
		return
	}

	createBackupResponse := CreateBackupResponse{
		Success: false,
	}

	sess, err := session.Parse(r.Header.Get("Authorization"))
	if err != nil {
		logger.Error(err)
		createBackupResponse.Error = "failed to parse authorization header"
		JSON(w, 401, createBackupResponse)
		return
	}

	// we don't currently have roles, all valid tokens are valid sessions
	if sess == nil || sess.ID == "" {
		createBackupResponse.Error = "failed to parse authorization header"
		JSON(w, 401, createBackupResponse)
		return
	}

	foundApp, err := app.GetFromSlug(mux.Vars(r)["appSlug"])
	if err != nil {
		logger.Error(err)
		createBackupResponse.Error = "failed to get app from app slug"
		JSON(w, 500, createBackupResponse)
		return
	}

	err = snapshot.CreateBackup(foundApp)
	if err != nil {
		logger.Error(err)
		createBackupResponse.Error = "failed to create backup"
		JSON(w, 500, createBackupResponse)
		return
	}

	createBackupResponse.Success = true

	JSON(w, 200, createBackupResponse)
}

type ListBackupsResponse struct {
	Error   string                  `json:"error,omitempty"`
	Backups []*snapshottypes.Backup `json:"backups"`
}

func ListBackups(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "content-type, origin, accept, authorization")

	if r.Method == "OPTIONS" {
		w.WriteHeader(200)
		return
	}

	listBackupsResponse := ListBackupsResponse{}

	sess, err := session.Parse(r.Header.Get("Authorization"))
	if err != nil {
		logger.Error(err)
		listBackupsResponse.Error = "failed to parse authorization header"
		JSON(w, 401, listBackupsResponse)
		return
	}

	// we don't currently have roles, all valid tokens are valid sessions
	if sess == nil || sess.ID == "" {
		listBackupsResponse.Error = "failed to parse authorization header"
		JSON(w, 401, listBackupsResponse)
		return
	}

	foundApp, err := app.GetFromSlug(mux.Vars(r)["appSlug"])
	if err != nil {
		logger.Error(err)
		listBackupsResponse.Error = "failed to get app from app slug"
		JSON(w, 500, listBackupsResponse)
		return
	}

	backups, err := snapshot.ListBackupsForApp(foundApp.ID)
	if err != nil {
		logger.Error(err)
		listBackupsResponse.Error = "failed to list backups"
		JSON(w, 500, listBackupsResponse)
		return
	}
	listBackupsResponse.Backups = backups

	JSON(w, 200, listBackupsResponse)
}
