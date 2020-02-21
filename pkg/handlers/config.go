package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	kotsv1beta1 "github.com/replicatedhq/kots/kotskinds/apis/kots/v1beta1"
	"github.com/replicatedhq/kots/kotskinds/multitype"
	"github.com/replicatedhq/kots/pkg/crypto"
	"github.com/replicatedhq/kotsadm/pkg/app"
	"github.com/replicatedhq/kotsadm/pkg/kotsutil"
	"github.com/replicatedhq/kotsadm/pkg/logger"
	"github.com/replicatedhq/kotsadm/pkg/session"
	serializer "k8s.io/apimachinery/pkg/runtime/serializer/json"
	"k8s.io/client-go/kubernetes/scheme"
)

type UpdateAppConfigRequest struct {
	Sequence         int                        `json:"seqeunce"`
	CreateNewVersion bool                       `json:"createNewVersion"`
	ConfigGroups     []*kotsv1beta1.ConfigGroup `json:"configGroups"`
}

type UpdateAppConfigResponse struct {
	Success bool `json:"success"`
}

func UpdateAppConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "content-type, origin, accept, authorization")

	if r.Method == "OPTIONS" {
		w.WriteHeader(200)
		return
	}

	updateAppConfigRequest := UpdateAppConfigRequest{}
	if err := json.NewDecoder(r.Body).Decode(&updateAppConfigRequest); err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}

	sess, err := session.Parse(r.Header.Get("Authorization"))
	if err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}

	// we don't currently have roles, all valid tokens are valid sessions
	if sess == nil || sess.ID == "" {
		w.WriteHeader(401)
		return
	}

	foundApp, err := app.GetFromSlug(mux.Vars(r)["appSlug"])
	if err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}

	archiveDir, err := app.GetAppVersionArchive(foundApp.ID, updateAppConfigRequest.Sequence)
	if err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}
	defer os.RemoveAll(archiveDir)

	kotsKinds, err := kotsutil.LoadKotsKindsFromPath(archiveDir)
	if err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}

	// we don't merge, this is a wholesale replacement of the config values
	// so we don't need the complex logic in kots, we can just write
	values := kotsKinds.ConfigValues.Spec.Values
	for _, group := range updateAppConfigRequest.ConfigGroups {
		for _, item := range group.Items {
			if item.Value.Type == multitype.Bool {
				updatedValue := item.Value.BoolVal
				v := values[item.Name]
				v.Value = strconv.FormatBool(updatedValue)
				values[item.Name] = v
			} else if item.Value.Type == multitype.String {
				updatedValue := item.Value.String()
				if item.Type == "password" {
					// encrypt using the key
					cipher, err := crypto.AESCipherFromString(kotsKinds.Installation.Spec.EncryptionKey)
					if err != nil {
						logger.Error(err)
						w.WriteHeader(500)
						return
					}

					updatedValue = base64.StdEncoding.EncodeToString(cipher.Encrypt([]byte(updatedValue)))
				}

				v := values[item.Name]
				v.Value = updatedValue
				values[item.Name] = v
			}
		}
	}

	if kotsKinds.ConfigValues == nil {
		logger.Error(errors.New("no config values found"))
		w.WriteHeader(500)
		return
	}

	kotsKinds.ConfigValues.Spec.Values = values

	s := serializer.NewYAMLSerializer(serializer.DefaultMetaFactory, scheme.Scheme, scheme.Scheme)
	var b bytes.Buffer
	if err := s.Encode(kotsKinds.ConfigValues, &b); err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}
	if err := ioutil.WriteFile(filepath.Join(archiveDir, "upstream", "userdata", "config.yaml"), b.Bytes(), 0644); err != nil {
		logger.Error(err)
		w.WriteHeader(500)
		return
	}

	if updateAppConfigRequest.CreateNewVersion {
		newSequence, err := foundApp.CreateVersion(archiveDir, "Config Change")
		if err != nil {
			logger.Error(err)
			w.WriteHeader(500)
			return
		}

		if err := app.CreateAppVersionArchive(foundApp.ID, newSequence, archiveDir); err != nil {
			logger.Error(err)
			w.WriteHeader(500)
			return
		}
	} else {
		// TODO
	}

	updateAppConfigResponse := UpdateAppConfigResponse{
		Success: true,
	}

	JSON(w, 200, updateAppConfigResponse)
}