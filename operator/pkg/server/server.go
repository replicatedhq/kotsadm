package server

import (
	"encoding/json"
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/replicatedhq/kotsadm/pkg/logger"
)

type HealthzResponse struct {
	Version string         `json:"version"`
	GitSHA  string         `json:"gitSha"`
	Status  StatusResponse `json:"status"`
}

type StatusResponse struct {
	Database DatabaseResponse `json:"database"`
	Storage  StorageResponse  `json:"storage"`
}

type DatabaseResponse struct {
	Connected bool `json:"connected"`
}

type StorageResponse struct {
	Available bool `json:"available"`
}

func Serve() error {
	handler := http.NewServeMux()

	handler.HandleFunc("/healthz", Healthz)
	handler.Handle("/metrics", promhttp.Handler())

	server := &http.Server{
		Addr:    ":3000",
		Handler: handler,
	}
	return server.ListenAndServe()
}

func Healthz(w http.ResponseWriter, r *http.Request) {
	// TODO
	isDatabaseConnected := true
	isStorageAvailable := true

	healthzResponse := HealthzResponse{
		Version: "test",
		GitSHA:  "test",
		Status: StatusResponse{
			Database: DatabaseResponse{
				Connected: isDatabaseConnected,
			},
			Storage: StorageResponse{
				Available: isStorageAvailable,
			},
		},
	}

	statusCode := 200
	if !isDatabaseConnected || !isStorageAvailable {
		statusCode = 419
	}

	JSON(w, statusCode, healthzResponse)
}

func JSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}
