package libyaml

type CustomRequirement struct {
	ID      string                `yaml:"id" json:"id" validate:"required,customrequirementidunique"`
	Message Message               `yaml:"message" json:"message"`
	Details *Message              `yaml:"details,omitempty" json:"details,omitempty"`
	When    BoolString            `yaml:"when,omitempty" json:"when,omitempty"`
	Command CustomCommand         `yaml:"command" json:"command"`
	Results []CustomCommandResult `yaml:"results" json:"results" validate:"required,min=1,dive"`
}
