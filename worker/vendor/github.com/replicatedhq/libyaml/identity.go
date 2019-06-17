package libyaml

type Identity struct {
	Enabled            string           `yaml:"enabled" json:"enabled"`
	Provisioner        string           `yaml:"provisioner" json:"provisioner"`
	Sources            []IdentitySource `yaml:"sources" json:"sources"`
	EnableResetRequest string           `yaml:"enable_reset_request" json:"enable_reset_request"`
}
