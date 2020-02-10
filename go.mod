module github.com/replicatedhq/kotsadm

go 1.12

require (
	github.com/dgrijalva/jwt-go v3.2.0+incompatible
	github.com/gorilla/mux v1.7.3
	github.com/gorilla/websocket v1.4.0
	github.com/lib/pq v1.3.0
	github.com/pkg/errors v0.8.1
	github.com/prometheus/client_golang v0.9.3
	github.com/replicatedhq/kots v1.9.0
	github.com/segmentio/ksuid v1.0.2
	github.com/smartystreets/assertions v1.0.0 // indirect
	github.com/spf13/cobra v0.0.5
	github.com/spf13/viper v1.6.1
	go.uber.org/zap v1.13.0
	golang.org/x/crypto v0.0.0-20190911031432-227b76d455e7
	golang.org/x/oauth2 v0.0.0-20190402181905-9f3314589c9a // indirect
	google.golang.org/appengine v1.5.0 // indirect
	k8s.io/apimachinery v0.0.0-20190404173353-6a84e37a896d
	k8s.io/client-go v11.0.1-0.20190409021438-1a26190bd76a+incompatible
	sigs.k8s.io/controller-runtime v0.2.0-beta.2
)

replace github.com/nicksnyder/go-i18n => github.com/nicksnyder/go-i18n v2.0.3+incompatible
