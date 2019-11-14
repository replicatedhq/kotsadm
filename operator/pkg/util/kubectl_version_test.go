package util

import (
	"testing"
)

func Test_matchKnownVersion(t *testing.T) {
	tests := []struct {
		name       string
		userString string
		want       string
	}{
		{
			name:       "16",
			userString: "16",
			want:       "v1.16.1",
		},
		{
			name:       "notexist",
			userString: "1.11",
			want:       "1.11",
		},
		{
			name:       "1.16",
			userString: "1.16",
			want:       "v1.16.1",
		},
		{
			name:       "1.14.x",
			userString: "1.14.x",
			want:       "v1.14.7",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := matchKnownVersion(tt.userString); got != tt.want {
				t.Errorf("matchKnownVersion() = %v, want %v", got, tt.want)
			}
		})
	}
}