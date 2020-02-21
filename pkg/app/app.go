package app

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/pkg/errors"
	"github.com/replicatedhq/kotsadm/pkg/kotsutil"
	"github.com/replicatedhq/kotsadm/pkg/logger"
	"github.com/replicatedhq/kotsadm/pkg/persistence"
	"go.uber.org/zap"
)

type App struct {
	ID              string
	Slug            string
	Name            string
	IsAirgap        bool
	CurrentSequence int
	Downstreams     []*Downstream

	// Additional fields will be added here as implementation is moved from node to go

	RegistrySettings *RegistrySettings
}

type Downstream struct {
	ClusterID string
	Name      string
}

func Get(id string) (*App, error) {
	logger.Debug("getting app from id",
		zap.String("id", id))

	db := persistence.MustGetPGSession()
	query := `select id, slug, name, current_sequence, is_airgap, registry_hostname, registry_username, registry_password_enc, namespace from app where id = $1`
	row := db.QueryRow(query, id)

	app := App{}

	var registryHostname sql.NullString
	var registryUsername sql.NullString
	var registryPasswordEnc sql.NullString
	var registryNamespace sql.NullString

	if err := row.Scan(&app.ID, &app.Slug, &app.Name, &app.CurrentSequence, &app.IsAirgap,
		&registryHostname, &registryUsername, &registryPasswordEnc, &registryNamespace); err != nil {
		return nil, errors.Wrap(err, "failed to scan app")
	}

	if registryHostname.Valid {
		registrySettings := RegistrySettings{
			Hostname:    registryHostname.String,
			Username:    registryUsername.String,
			HasPassword: registryPasswordEnc.Valid,
			Namespace:   registryNamespace.String,
		}

		app.RegistrySettings = &registrySettings
	}

	query = `select cluster_id, downstream_name from app_downstream where app_id = $1`
	rows, err := db.Query(query, id)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get downstreams")
	}

	downstreams := []*Downstream{}
	for rows.Next() {
		downstream := Downstream{}
		if err := rows.Scan(&downstream.ClusterID, &downstream.Name); err != nil {
			return nil, errors.Wrap(err, "failed to scan downstream")
		}

		downstreams = append(downstreams, &downstream)
	}
	app.Downstreams = downstreams

	return &app, nil
}

func GetFromSlug(slug string) (*App, error) {
	logger.Debug("getting app from slug",
		zap.String("slug", slug))

	db := persistence.MustGetPGSession()
	query := `select id from app where slug = $1`
	row := db.QueryRow(query, slug)

	id := "'"

	if err := row.Scan(&id); err != nil {
		return nil, errors.Wrap(err, "failed to scan id")
	}

	return Get(id)
}

// CreateVersion creates a new version of the app in the database, but the caller
// is responsible for uploading the archive to s3
func (a App) CreateVersion(filesInDir string) (int64, error) {
	kotsKinds, err := kotsutil.LoadKotsKindsFromPath(filesInDir)
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to read kots kinds")
	}

	supportBundleSpec, err := kotsKinds.Marshal("troubleshoot.replicated.com", "v1beta1", "Collector")
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to marshal support bundle spec")
	}
	analyzersSpec, err := kotsKinds.Marshal("troubleshoot.replicated.com", "v1beta1", "Analyzer")
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to marshal analyzer spec")
	}
	preflightSpec, err := kotsKinds.Marshal("troubleshoot.replicated.com", "v1beta1", "Preflight")
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to marshal preflight spec")
	}

	appSpec, err := kotsKinds.Marshal("app.k8s.io", "v1beta1", "Application")
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to marshal app spec")
	}
	kotsAppSpec, err := kotsKinds.Marshal("kots.io", "v1beta1", "Application")
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to marshal kots app spec")
	}
	backupSpec, err := kotsKinds.Marshal("velero.io", "v1", "Backup")
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to marshal backup spec")
	}

	licenseSpec, err := kotsKinds.Marshal("kots.io", "v1beta1", "License")
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to marshal license spec")
	}
	configSpec, err := kotsKinds.Marshal("kots.io", "v1beta1", "Config")
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to marshal config spec")
	}
	configValuesSpec, err := kotsKinds.Marshal("kots.io", "v1beta1", "ConfigValues")
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to marshal configvalues spec")
	}

	db := persistence.MustGetPGSession()

	tx, err := db.Begin()
	if err != nil {
		return 0, errors.Wrap(err, "failed to begin")
	}
	defer tx.Rollback()

	query := `insert into app_version (app_id, sequence, created_at, version_label, release_notes, update_cursor, channel_name, encryption_key,
supportbundle_spec, analyzer_spec, preflight_spec, app_spec, kots_app_spec, kots_license, config_spec, config_values, backup_spec)
values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
ON CONFLICT(app_id, sequence) DO UPDATE SET
created_at = EXCLUDED.created_at,
version_label = EXCLUDED.version_label,
release_notes = EXCLUDED.release_notes,
update_cursor = EXCLUDED.update_cursor,
channel_name = EXCLUDED.channel_name,
encryption_key = EXCLUDED.encryption_key,
supportbundle_spec = EXCLUDED.supportbundle_spec,
analyzer_spec = EXCLUDED.analyzer_spec,
preflight_spec = EXCLUDED.preflight_spec,
app_spec = EXCLUDED.app_spec,
kots_app_spec = EXCLUDED.kots_app_spec,
kots_license = EXCLUDED.kots_license,
config_spec = EXCLUDED.config_spec,
config_values = EXCLUDED.config_values,
backup_spec = EXCLUDED.backup_spec`
	_, err = tx.Exec(query, a.ID, a.CurrentSequence+1, time.Now(),
		kotsKinds.Installation.Spec.VersionLabel,
		kotsKinds.Installation.Spec.ReleaseNotes,
		kotsKinds.Installation.Spec.UpdateCursor,
		kotsKinds.Installation.Spec.ChannelName,
		kotsKinds.Installation.Spec.EncryptionKey,
		supportBundleSpec,
		analyzersSpec,
		preflightSpec,
		appSpec,
		kotsAppSpec,
		licenseSpec,
		configSpec,
		configValuesSpec,
		backupSpec)
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to insert app version")
	}

	appName := kotsKinds.KotsApplication.Spec.Title
	if appName == "" {
		appName = a.Name
	}

	appIcon := kotsKinds.KotsApplication.Spec.Icon

	query = "update app set current_sequence = $1, name = $2, icon_uri = $3 where id = $4"
	_, err = tx.Exec(query, int64(a.CurrentSequence+1), appName, appIcon, a.ID)
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to update app")
	}

	downstreamStatus := "pending_preflight"
	if kotsKinds.Preflight == nil {
		downstreamStatus = "pending"
	}

	// Get the previous archive, we need this to calculate the diff
	previousArchiveDir, err := GetAppVersionArchive(a.ID, a.CurrentSequence)
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to get previous archive")
	}

	fmt.Printf("downstream = %#v\n", a.Downstreams)
	for _, downstream := range a.Downstreams {
		// TODO support gitops downstrweams

		// diff this release from the last release
		diff, err := diffAppVersionsForDownstreams(downstream.Name, filesInDir, previousArchiveDir)
		if err != nil {
			return int64(0), errors.Wrap(err, "failed to diff")
		}
		diffSummary, err := json.Marshal(diff)
		if err != nil {
			return int64(0), errors.Wrap(err, "failed to marshal diff")
		}

		fmt.Printf("diff = %#v\n", diff)
		commitURL := ""
		isGitDeployable := false

		query = `select max(sequence) from app_downstream_version where app_id = $1 and cluster_id = $2`
		row := tx.QueryRow(query, a.ID, downstream.ClusterID)

		lastDownstreamSequence := int64(-1)
		if err := row.Scan(&lastDownstreamSequence); err != nil {
			// continue
		}
		newSequence := lastDownstreamSequence + 1

		query = `insert into app_downstream_version (app_id, cluster_id, sequence, parent_sequence, created_at, version_label, status, source, diff_summary, git_commit_url, git_deployable) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
		_, err = tx.Exec(query, a.ID, downstream.ClusterID, newSequence, a.CurrentSequence+1, time.Now(),
			kotsKinds.Installation.Spec.VersionLabel, downstreamStatus, "Registry Change",
			string(diffSummary), commitURL, isGitDeployable)
		if err != nil {
			return int64(0), errors.Wrap(err, "failed to create downstream version")
		}
	}

	if err = tx.Commit(); err != nil {
		return int64(0), errors.Wrap(err, "failed to commit")
	}

	return int64(a.CurrentSequence + 1), nil
}