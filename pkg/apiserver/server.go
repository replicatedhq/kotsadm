package apiserver

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/gorilla/mux"
	"github.com/replicatedhq/kotsadm/pkg/automation"
	"github.com/replicatedhq/kotsadm/pkg/handlers"
	"github.com/replicatedhq/kotsadm/pkg/informers"
)

func Start() {
	log.Printf("kotsadm version %s built with %s\n", os.Getenv("VERSION"), runtime.Version())

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
	if err := waitForDependencies(ctx); err != nil {
		panic(err)
	}
	cancel()

	if err := informers.Start(); err != nil {
		log.Println("Failed to start informers", err)
	}

	if err := automation.AutomateInstall(); err != nil {
		log.Println("Failed to run automated installs", err)
	}

	u, err := url.Parse("http://kotsadm-api-node:3000")
	if err != nil {
		panic(err)
	}
	upstream := httputil.NewSingleHostReverseProxy(u)

	r := mux.NewRouter()
	r.Use(mux.CORSMethodMiddleware(r))

	r.HandleFunc("/healthz", handlers.Healthz)

	// proxy all graphql requests
	r.Path("/graphql").Methods("OPTIONS").HandlerFunc(handlers.CORS)
	r.Path("/graphql").Methods("POST").HandlerFunc(handlers.NodeProxy(upstream))

	// Functions that the operator calls
	r.Path("/api/v1/appstatus").Methods("PUT").HandlerFunc(handlers.NodeProxy(upstream))
	r.Path("/api/v1/deploy/result").Methods("PUT").HandlerFunc(handlers.NodeProxy(upstream))
	r.Path("/api/v1/preflight/{appSlug}/{clusterSlug}/{sequence}").Methods("GET").HandlerFunc(handlers.NodeProxy(upstream))
	r.Path("/api/v1/preflight/{appSlug}/{clusterSlug}/{sequence}").Methods("POST").HandlerFunc(handlers.NodeProxy(upstream))
	r.Path("/api/v1/troubleshoot").Methods("OPTIONS", "GET").HandlerFunc(handlers.GetDefaultTroubleshoot)
	r.Path("/api/v1/troubleshoot/{appSlug}").Methods("OPTIONS", "GET").HandlerFunc(handlers.GetTroubleshoot)
	r.Path("/api/v1/troubleshoot/{appId}/{bundleId}").Methods("PUT").HandlerFunc(handlers.NodeProxy(upstream))

	r.Path("/api/v1/troubleshoot/supportbundle/{bundleId}/download").Methods("GET").HandlerFunc(handlers.NodeProxy(upstream))
	r.Path("/api/v1/troubleshoot/analyzebundle/{bundleId}").Methods("POST").HandlerFunc(handlers.NodeProxy(upstream))

	r.PathPrefix("/api/v1/kots/").Methods("OPTIONS").HandlerFunc(handlers.CORS)
	r.PathPrefix("/api/v1/kots/").Methods("HEAD", "GET", "POST", "PUT", "DELETE").HandlerFunc(handlers.NodeProxy(upstream))

	// proxy for license/titled api
	r.Path("/license/v1/license").Methods("GET").HandlerFunc(handlers.NodeProxy(upstream))

	// Airgap upload and update
	r.Path("/api/v1/app/airgap").Methods("OPTIONS", "POST", "PUT").HandlerFunc(handlers.UploadAirgapBundle)

	// Implemented handlers
	r.Path("/api/v1/license/platform").Methods("OPTIONS", "POST").HandlerFunc(handlers.ExchangePlatformLicense)
	r.Path("/api/v1/app/{appSlug}/sequence/{sequence}/preflight/ignore-rbac").Methods("OPTIONS", "POST").HandlerFunc(handlers.IgnorePreflightRBACErrors)
	r.Path("/api/v1/app/{appSlug}/preflight/run").Methods("OPTIONS", "POST").HandlerFunc(handlers.StartPreflightChecks)
	r.Path("/api/v1/upload").Methods("PUT").HandlerFunc(handlers.UploadExistingApp)
	r.Path("/api/v1/download").Methods("GET").HandlerFunc(handlers.DownloadApp)
	r.Path("/api/v1/app/{appSlug}/sequence/{sequence}/renderedcontents").Methods("OPTIONS", "GET").HandlerFunc(handlers.GetAppRenderedContents)

	r.HandleFunc("/api/v1/login", handlers.Login)
	r.HandleFunc("/api/v1/logout", handlers.NotImplemented)

	// Installation
	r.Path("/api/v1/license").Methods("OPTIONS", "POST").HandlerFunc(handlers.UploadNewLicense)
	r.Path("/api/v1/license/resume").Methods("OPTIONS", "PUT").HandlerFunc(handlers.ResumeInstallOnline)

	r.Path("/api/v1/metadata").Methods("OPTIONS", "GET").HandlerFunc(handlers.Metadata)
	r.Path("/api/v1/app/{appSlug}/registry").Methods("OPTIONS", "PUT").HandlerFunc(handlers.UpdateAppRegistry)
	r.Path("/api/v1/app/{appSlug}/config").Methods("OPTIONS", "PUT").HandlerFunc(handlers.UpdateAppConfig)
	r.Path("/api/v1/app/{appSlug}/license").Methods("OPTIONS", "PUT").HandlerFunc(handlers.SyncLicense)
	r.Path("/api/v1/app/{appSlug}/updatecheck").Methods("OPTIONS", "POST").HandlerFunc(handlers.AppUpdateCheck)

	// App snapshot routes
	r.Path("/api/v1/app/{appSlug}/snapshot/backup").Methods("OPTIONS", "POST").HandlerFunc(handlers.CreateBackup)
	r.Path("/api/v1/app/{appSlug}/snapshot/restore/status").Methods("OPTIONS", "GET").HandlerFunc(handlers.GetRestoreStatus)
	r.Path("/api/v1/app/{appSlug}/snapshots").Methods("OPTIONS", "GET").HandlerFunc(handlers.ListBackups)

	// Global snapshot routes
	r.Path("/api/v1/snapshots/settings").Methods("OPTIONS", "GET").HandlerFunc(handlers.GetGlobalSnapshotSettings)
	r.Path("/api/v1/snapshots/settings").Methods("OPTIONS", "PUT").HandlerFunc(handlers.UpdateGlobalSnapshotSettings)
	r.Path("/api/v1/snapshot/{snapshotName}/restore").Methods("OPTIONS", "POST").HandlerFunc(handlers.CreateRestore)

	// Find a home snapshot routes
	r.Path("/api/v1/snapshot/{backup}/logs").Methods("OPTIONS", "GET").HandlerFunc(handlers.DownloadSnapshotLogs)

	// redactor routes
	r.Path("/api/v1/redact/set").Methods("OPTIONS", "PUT").HandlerFunc(handlers.UpdateRedact)
	r.Path("/api/v1/redact/get").Methods("OPTIONS", "GET").HandlerFunc(handlers.GetRedact)

	// TODO

	// KURL
	r.HandleFunc("/api/v1/kurl", handlers.NotImplemented)
	r.Path("/api/v1/kurl/generate-node-join-command-worker").
		Methods("OPTIONS", "POST").
		HandlerFunc(handlers.GenerateNodeJoinCommandWorker)
	r.Path("/api/v1/kurl/generate-node-join-command-master").
		Methods("OPTIONS", "POST").
		HandlerFunc(handlers.GenerateNodeJoinCommandMaster)

	// Prom
	r.HandleFunc("/api/v1/prometheus", handlers.NotImplemented)

	// GitOps
	r.HandleFunc("/api/v1/gitops", handlers.NotImplemented)

	// to avoid confusion, we don't serve this in the dev env...
	if os.Getenv("DISABLE_SPA_SERVING") != "1" {
		spa := handlers.SPAHandler{StaticPath: filepath.Join("web", "dist"), IndexPath: "index.html"}
		r.PathPrefix("/").Handler(spa)
	}

	srv := &http.Server{
		Handler: r,
		Addr:    ":3000",
	}

	fmt.Printf("Starting kotsadm API on port %d...\n", 3000)

	log.Fatal(srv.ListenAndServe())
}
