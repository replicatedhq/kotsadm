package libyaml

type CustomCommand struct {
	ID      string      `yaml:"id" json:"id" validate:"required"`
	Timeout int         `yaml:"timeout,omitempty" json:"timeout,omitempty"`
	Data    interface{} `yaml:"data,omitempty" json:"data,omitempty"`
}

type CustomCommandResult struct {
	Status    string                  `yaml:"status" json:"status" validate:"required"`
	Message   Message                 `yaml:"message" json:"message"`
	Condition *CustomCommandCondition `yaml:"condition,omitempty" json:"condition,omitempty"`
}

type CustomCommandCondition struct {
	Error      bool       `yaml:"error,omitempty" json:"error,omitempty"`
	StatusCode *int       `yaml:"status_code,omitempty" json:"status_code,omitempty"`
	BoolExpr   BoolString `yaml:"bool_expr,omitempty" json:"bool_expr,omitempty"`
}
