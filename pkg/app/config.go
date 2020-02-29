package app

import (
	"github.com/pkg/errors"
	kotsv1beta1 "github.com/replicatedhq/kots/kotskinds/apis/kots/v1beta1"
	kotsconfig "github.com/replicatedhq/kots/pkg/config"
	"github.com/replicatedhq/kots/pkg/crypto"
	"github.com/replicatedhq/kots/pkg/template"
	"k8s.io/client-go/kubernetes/scheme"
)

func templateConfig(config *kotsv1beta1.Config, configValues *kotsv1beta1.ConfigValues, license *kotsv1beta1.License, encryptionKey string) (string, error) {
	builder := template.Builder{}
	builder.AddCtx(template.StaticCtx{})

	var templateContext map[string]template.ItemValue
	if configValues != nil {
		ctx := map[string]template.ItemValue{}
		for k, v := range configValues.Spec.Values {
			ctx[k] = template.ItemValue{
				Value:   v.Value,
				Default: v.Default,
			}
		}
		templateContext = ctx
	} else {
		templateContext = map[string]template.ItemValue{}
	}

	var cipher *crypto.AESCipher
	if encryptionKey != "" {
		c, err := crypto.AESCipherFromString(encryptionKey)
		if err != nil {
			return "", errors.Wrap(err, "failed to create cipher")
		}
		cipher = c
	}

	localRegistry := template.LocalRegistry{}

	configCtx, err := builder.NewConfigContext(config.Spec.Groups, templateContext, localRegistry, cipher, license)
	if err != nil {
		return "", errors.Wrap(err, "failed to create config context")
	}

	kotsconfig.ApplyValuesToConfig(config, configCtx.ItemValues)
	configDocWithData, err := kotsconfig.MarshalConfig(config)
	if err != nil {
		return "", errors.Wrap(err, "failed to marshal config")
	}

	builder.AddCtx(configCtx)

	rendered, err := builder.RenderTemplate("config", string(configDocWithData))
	if err != nil {
		return "", errors.Wrap(err, "failed to render config template")
	}

	return rendered, nil
}

func IsUnsetRequiredItem(item *kotsv1beta1.ConfigItem) bool {
	if !item.Required {
		return false
	}
	if item.Hidden || item.When == "false" {
		return false
	}
	if item.Value.String() != "" {
		return false
	}
	if item.Default.String() != "" {
		return false
	}
	return true
}

func needsConfiguration(config *kotsv1beta1.Config, configValues *kotsv1beta1.ConfigValues, license *kotsv1beta1.License, encryptionKey string) (bool, error) {
	rendered, err := templateConfig(config, configValues, license, encryptionKey)
	if err != nil {
		return false, errors.Wrap(err, "failed to template config")
	}

	decode := scheme.Codecs.UniversalDeserializer().Decode
	decoded, _, _ := decode([]byte(rendered), nil, nil)
	if err != nil {
		return false, errors.Wrap(err, "failed to decode config")
	}
	renderedConfig := decoded.(*kotsv1beta1.Config)

	for _, group := range renderedConfig.Spec.Groups {
		for _, item := range group.Items {
			if IsUnsetRequiredItem(&item) {
				return true, nil
			}
		}
	}
	return false, nil
}
