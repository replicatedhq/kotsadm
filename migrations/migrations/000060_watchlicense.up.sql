create table watch_license (
  watch_id text primary key not null,
  license text,
  license_updated_at timestamp without time zone,
  updated_license text,
  updated_license_updated_at timestamp without time zone
);