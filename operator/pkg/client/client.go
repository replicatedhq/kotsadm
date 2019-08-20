package client

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os/exec"
	"time"

	"github.com/pkg/errors"
	"github.com/replicatedhq/kotsadm/operator/pkg/applier"
	"github.com/replicatedhq/kotsadm/operator/pkg/helm"
	"k8s.io/client-go/rest"
)

type Client struct {
	APIEndpoint string
	Token       string
}

func (c *Client) Run() error {
	for {
		desiredState, err := getDesiredStateFromKotsadmServer(c.APIEndpoint, c.Token)
		if err != nil {
			return errors.Wrap(err, "failed to get desired state from server")
		}

		// Deploy
		for _, present := range desiredState.Present {
			decoded, err := base64.StdEncoding.DecodeString(present)
			if err != nil {
				fmt.Printf("error decoding: %#v\n", err)
				continue
			}

			deployable, err := removeInternalGVK(decoded)
			if err != nil {
				fmt.Printf("error removing internal gvk objects: %#v\n", err)
				continue
			}

			if err := ensureResourcesPresent(deployable); err != nil {
				fmt.Printf("error in apply: %#v\n", err)
				continue
			}
		}

		time.Sleep(time.Second * 10)
	}
}

type DesiredState struct {
	Present []string `json:"present"`
	Missing []string `json:"missing"`
}

func getDesiredStateFromKotsadmServer(apiEndpoint string, token string) (*DesiredState, error) {
	client := &http.Client{}

	uri := fmt.Sprintf("%s/api/v1/deploy/desired", apiEndpoint)

	// fmt.Printf("Requesting desired state from %q\n", uri)
	req, err := http.NewRequest("GET", uri, nil)
	req.SetBasicAuth("", token)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code from kotsadm server: %d", resp.StatusCode)
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var desiredState DesiredState
	if err := json.Unmarshal(body, &desiredState); err != nil {
		return nil, err
	}

	return &desiredState, nil
}

func reportCurrentStateToKotsadmServer(apiEndpoint string, token string, helmApplications []*helm.HelmApplication) error {
	currentState := struct {
		HelmApplications []*helm.HelmApplication `json:"helmApplications"`
	}{
		helmApplications,
	}

	b, err := json.Marshal(currentState)
	if err != nil {
		return err
	}

	client := &http.Client{}

	uri := fmt.Sprintf("%s/api/v1/current", apiEndpoint)

	fmt.Printf("Reporting helm charts to %q\n", uri)
	req, err := http.NewRequest("POST", uri, bytes.NewBuffer(b))
	req.Header["Content-Type"] = []string{"application/json"}
	req.SetBasicAuth("", token)
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code from kotsadm server: %d", resp.StatusCode)
	}

	return nil
}

func ensureResourcesPresent(input []byte) error {
	// TODO sort, order matters
	// TODO should we split multi-doc to retry on failed?

	fmt.Println("finding kubectl")
	kubectl, err := exec.LookPath("kubectl")
	if err != nil {
		return errors.Wrap(err, "failed to find kubectl")
	}

	config, err := rest.InClusterConfig()
	if err != nil {
		return errors.Wrap(err, "failed to get in cluster config")
	}

	// this is pretty raw, and required kubectl...  we should
	// consider some other options here?
	kubernetesApplier := applier.NewKubectl(kubectl, config)

	fmt.Println("dry run applying manifests(s)")
	if err := kubernetesApplier.Apply(input, true); err != nil {
		return errors.Wrap(err, "dry run failed")
	}

	fmt.Println("applying manifest(s)")
	kubernetesApplier.Apply(input, false)

	return nil
}

func ensureResourcesMissing(input []byte) error {
	// TODO sort, order matters
	// TODO should we split multi-doc to retry on failed?

	kubectl, err := exec.LookPath("kubectl")
	if err != nil {
		fmt.Println(err)
		return err
	}

	config, err := rest.InClusterConfig()
	if err != nil {
		return errors.Wrap(err, "failed to get in cluster config")
	}

	// this is pretty raw, and required kubectl...  we should
	// consider some other options here?
	kubernetesApplier := applier.NewKubectl(kubectl, config)
	go kubernetesApplier.Remove(input)

	return nil
}
