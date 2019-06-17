package libyaml

type StatsD struct {
	Port int32 `yaml:"port" json:"port" validate:"tcpport"`
}

type Graphite struct {
	Port int32 `yaml:"port" json:"port" validate:"tcpport"`
}

type Carbon struct {
	PlaintextPort int32 `yaml:"plaintext_port" json:"plaintext_port" validate:"tcpport"`
	PicklePort    int32 `yaml:"pickle_port" json:"pickle_port" validate:"tcpport"`
}
