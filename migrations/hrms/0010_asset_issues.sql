-- Preserve existing assignments as issue records before removing them from inventory.
INSERT OR IGNORE INTO talent_records(company_id, collection, id, payload, revision, created_at, updated_at)
SELECT company_id, 'asset_issues', 'legacy-' || id,
  json_object('title', json_extract(payload,'$.title'), 'asset_id', id,
    'employee_id', json_extract(payload,'$.employee_id'),
    'issue_date', COALESCE(NULLIF(json_extract(payload,'$.issue_date'),''), substr(created_at,1,10)),
    'received_date', '', 'return_date', '', 'status', 'Issued', 'acknowledgement_note', '',
    'notes', 'Migrated from the asset register.', 'history', json('[]')),
  0, created_at, updated_at
FROM talent_records WHERE collection='assets' AND json_extract(payload,'$.status')='Assigned'
AND COALESCE(json_extract(payload,'$.employee_id'),'')!='';
UPDATE talent_records SET payload=json_remove(json_set(payload,'$.status',
  CASE WHEN json_extract(payload,'$.status')='Assigned' THEN 'Available' ELSE json_extract(payload,'$.status') END), '$.employee_id', '$.issue_date'), revision=revision+1
WHERE collection='assets' AND (json_type(payload,'$.employee_id') IS NOT NULL OR json_type(payload,'$.issue_date') IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS talent_asset_active_issue ON talent_records(company_id, json_extract(payload,'$.asset_id'))
WHERE collection='asset_issues' AND json_extract(payload,'$.status') IN ('Issued','Received');
