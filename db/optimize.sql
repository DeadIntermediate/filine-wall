-- FiLine Wall PostgreSQL Optimization Script
-- Run this after initial database setup to optimize performance

-- ============================================
-- 1. INSTALL REQUIRED EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- Fuzzy text search for phone numbers
CREATE EXTENSION IF NOT EXISTS btree_gin;     -- Better JSONB indexing
CREATE EXTENSION IF NOT EXISTS pg_stat_statements; -- Query performance monitoring

-- Optional: If you want geographic features
-- CREATE EXTENSION IF NOT EXISTS postgis;

COMMENT ON EXTENSION pg_trgm IS 'Fuzzy string matching for phone number searches';
COMMENT ON EXTENSION btree_gin IS 'Optimized JSONB indexing';

-- ============================================
-- 2. PERFORMANCE INDEXES
-- ============================================

-- Phone Numbers Table
-- Most critical for lookups
CREATE INDEX IF NOT EXISTS idx_phone_number_lookup 
ON phone_numbers (number) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_phone_number_type 
ON phone_numbers (type, active);

CREATE INDEX IF NOT EXISTS idx_phone_reputation_score 
ON phone_numbers (reputation_score DESC) 
WHERE active = true;

-- Fuzzy search support
CREATE INDEX IF NOT EXISTS idx_phone_number_trgm 
ON phone_numbers USING GIST (number gist_trgm_ops);

-- JSONB indexes for ML data
CREATE INDEX IF NOT EXISTS idx_phone_score_factors 
ON phone_numbers USING GIN (score_factors);

CREATE INDEX IF NOT EXISTS idx_phone_blocking_rules 
ON phone_numbers USING GIN (blocking_rules);

-- Call Logs Table
-- Critical for analytics and pattern detection
CREATE INDEX IF NOT EXISTS idx_call_phone_number 
ON call_logs (phone_number);

CREATE INDEX IF NOT EXISTS idx_call_timestamp_desc 
ON call_logs (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_call_action 
ON call_logs (action, timestamp DESC);

-- Composite index for pattern analysis
CREATE INDEX IF NOT EXISTS idx_call_pattern_analysis 
ON call_logs (phone_number, timestamp, time_of_day, day_of_week);

-- Recent calls (dashboard performance)
CREATE INDEX IF NOT EXISTS idx_call_recent 
ON call_logs (timestamp DESC) 
WHERE timestamp > NOW() - INTERVAL '30 days';

-- JSONB indexes for metadata
CREATE INDEX IF NOT EXISTS idx_call_metadata 
ON call_logs USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_call_carrier_info 
ON call_logs USING GIN (carrier_info);

-- Device tracking
CREATE INDEX IF NOT EXISTS idx_call_device 
ON call_logs (device_id, timestamp DESC);

-- Spam Reports Table
CREATE INDEX IF NOT EXISTS idx_spam_phone_number 
ON spam_reports (phone_number, status);

CREATE INDEX IF NOT EXISTS idx_spam_reported_at 
ON spam_reports (reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_spam_category 
ON spam_reports (category, status);

-- Verified spam only (for quick lookups)
CREATE INDEX IF NOT EXISTS idx_spam_verified 
ON spam_reports (phone_number) 
WHERE status = 'verified';

-- JSONB metadata
CREATE INDEX IF NOT EXISTS idx_spam_metadata 
ON spam_reports USING GIN (metadata);

-- Call Patterns Table
CREATE INDEX IF NOT EXISTS idx_pattern_phone_number 
ON call_patterns (phone_number, active);

CREATE INDEX IF NOT EXISTS idx_pattern_type 
ON call_patterns (pattern_type, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_pattern_detected 
ON call_patterns (detected_at DESC);

-- JSONB pattern data
CREATE INDEX IF NOT EXISTS idx_pattern_data 
ON call_patterns USING GIN (pattern_data);

-- Voice Patterns Table
CREATE INDEX IF NOT EXISTS idx_voice_pattern_type 
ON voice_patterns (pattern_type, active);

CREATE INDEX IF NOT EXISTS idx_voice_confidence 
ON voice_patterns (confidence DESC) 
WHERE active = true;

-- JSONB features for ML
CREATE INDEX IF NOT EXISTS idx_voice_features 
ON voice_patterns USING GIN (features);

-- User Tables
CREATE INDEX IF NOT EXISTS idx_user_username 
ON users (username) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_user_email 
ON users (email) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_user_role 
ON users (role, active);

-- Sessions Table
CREATE INDEX IF NOT EXISTS idx_session_token 
ON sessions (token);

CREATE INDEX IF NOT EXISTS idx_session_user 
ON sessions (user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_session_active 
ON sessions (expires_at) 
WHERE expires_at > NOW();

-- User Preferences Table
CREATE INDEX IF NOT EXISTS idx_user_prefs_user_id 
ON user_preferences (user_id);

-- Blocking Rules Table
CREATE INDEX IF NOT EXISTS idx_blocking_rules_user 
ON blocking_rules (user_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_blocking_rules_priority 
ON blocking_rules (priority DESC) 
WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_blocking_rules_conditions 
ON blocking_rules USING GIN (conditions);

-- Geographic Rules Table
CREATE INDEX IF NOT EXISTS idx_geo_rules_region 
ON geo_rules (region, blocking_enabled);

CREATE INDEX IF NOT EXISTS idx_geo_rules_risk 
ON geo_rules (risk_level DESC);

-- Device Configurations Table
CREATE INDEX IF NOT EXISTS idx_device_config_id 
ON device_configurations (device_id) 
WHERE status = 'online';

CREATE INDEX IF NOT EXISTS idx_device_heartbeat 
ON device_configurations (last_heartbeat DESC);

-- Verification Codes Table
CREATE INDEX IF NOT EXISTS idx_verification_phone 
ON verification_codes (phone_number, used);

CREATE INDEX IF NOT EXISTS idx_verification_expires 
ON verification_codes (expires_at) 
WHERE used = false;

-- Feature Settings Table
CREATE INDEX IF NOT EXISTS idx_feature_settings_key 
ON feature_settings (feature_key) 
WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_feature_settings_category 
ON feature_settings (category, display_order);

-- ============================================
-- 3. MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================

-- Daily call statistics (pre-computed for dashboard)
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_call_stats AS
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE action = 'blocked') as blocked_calls,
  COUNT(*) FILTER (WHERE action = 'allowed') as allowed_calls,
  COUNT(DISTINCT phone_number) as unique_callers,
  AVG((metadata->>'risk_score')::decimal) as avg_risk_score,
  COUNT(*) FILTER (WHERE line_type = 'voip') as voip_calls,
  COUNT(*) FILTER (WHERE time_of_day >= 9 AND time_of_day <= 17) as business_hours_calls
FROM call_logs
WHERE timestamp > NOW() - INTERVAL '90 days'
GROUP BY DATE(timestamp);

CREATE UNIQUE INDEX ON daily_call_stats (date DESC);

-- Top spam numbers (pre-computed)
CREATE MATERIALIZED VIEW IF NOT EXISTS top_spam_numbers AS
SELECT 
  sr.phone_number,
  COUNT(DISTINCT sr.id) as report_count,
  sr.category,
  MAX(sr.reported_at) as last_reported,
  AVG(sr.confirmations) as avg_confirmations,
  pn.reputation_score
FROM spam_reports sr
LEFT JOIN phone_numbers pn ON sr.phone_number = pn.number
WHERE sr.status = 'verified'
  AND sr.reported_at > NOW() - INTERVAL '30 days'
GROUP BY sr.phone_number, sr.category, pn.reputation_score
HAVING COUNT(DISTINCT sr.id) >= 3
ORDER BY report_count DESC
LIMIT 1000;

CREATE INDEX ON top_spam_numbers (phone_number);
CREATE INDEX ON top_spam_numbers (category, report_count DESC);

-- Call pattern summary
CREATE MATERIALIZED VIEW IF NOT EXISTS call_pattern_summary AS
SELECT 
  phone_number,
  COUNT(*) as total_calls,
  MIN(timestamp) as first_call,
  MAX(timestamp) as last_call,
  COUNT(DISTINCT DATE(timestamp)) as days_active,
  COUNT(*) FILTER (WHERE action = 'blocked') as times_blocked,
  AVG(time_of_day) as avg_hour_of_day,
  MODE() WITHIN GROUP (ORDER BY day_of_week) as most_common_day,
  COUNT(*) FILTER (WHERE line_type = 'voip') as voip_count
FROM call_logs
WHERE timestamp > NOW() - INTERVAL '90 days'
GROUP BY phone_number
HAVING COUNT(*) >= 2;

CREATE UNIQUE INDEX ON call_pattern_summary (phone_number);
CREATE INDEX ON call_pattern_summary (times_blocked DESC);

-- ============================================
-- 4. AUTOMATIC REFRESH JOBS
-- ============================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_call_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY top_spam_numbers;
  REFRESH MATERIALIZED VIEW CONCURRENTLY call_pattern_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. PARTITIONING FOR CALL LOGS (Optional - for high volume)
-- ============================================

-- Uncomment if you expect >1M calls
-- This creates monthly partitions for better performance

/*
-- First, rename existing table
ALTER TABLE call_logs RENAME TO call_logs_old;

-- Create partitioned table
CREATE TABLE call_logs (
  id serial,
  phone_number text NOT NULL,
  timestamp timestamp DEFAULT NOW() NOT NULL,
  action text NOT NULL,
  duration text,
  metadata jsonb,
  latitude decimal(10, 7),
  longitude decimal(10, 7),
  caller_id jsonb NOT NULL,
  carrier_info jsonb,
  line_type text,
  time_of_day integer,
  day_of_week integer,
  device_id text
) PARTITION BY RANGE (timestamp);

-- Create partitions for current and next 3 months
CREATE TABLE call_logs_2025_10 PARTITION OF call_logs
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE call_logs_2025_11 PARTITION OF call_logs
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE call_logs_2025_12 PARTITION OF call_logs
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE call_logs_2026_01 PARTITION OF call_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Copy data from old table
INSERT INTO call_logs SELECT * FROM call_logs_old;

-- Drop old table
DROP TABLE call_logs_old;

-- Add indexes to partitions (repeat for each partition)
CREATE INDEX ON call_logs_2025_10 (phone_number);
CREATE INDEX ON call_logs_2025_10 (timestamp DESC);
*/

-- ============================================
-- 6. DATABASE MAINTENANCE FUNCTIONS
-- ============================================

-- Function to clean old verification codes
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM verification_codes
  WHERE expires_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM sessions
  WHERE expires_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old call logs
CREATE OR REPLACE FUNCTION archive_old_call_logs(days_to_keep integer DEFAULT 365)
RETURNS integer AS $$
DECLARE
  archived_count integer;
BEGIN
  -- Create archive table if it doesn't exist
  CREATE TABLE IF NOT EXISTS call_logs_archive (LIKE call_logs INCLUDING ALL);
  
  -- Move old records to archive
  WITH moved_rows AS (
    DELETE FROM call_logs
    WHERE timestamp < NOW() - (days_to_keep || ' days')::interval
    RETURNING *
  )
  INSERT INTO call_logs_archive
  SELECT * FROM moved_rows;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. PERFORMANCE MONITORING VIEWS
-- ============================================

-- View for slow queries (requires pg_stat_statements extension)
CREATE OR REPLACE VIEW slow_queries AS
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- Queries slower than 100ms
ORDER BY mean_exec_time DESC
LIMIT 50;

-- View for table sizes
CREATE OR REPLACE VIEW table_sizes AS
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- View for index usage
CREATE OR REPLACE VIEW index_usage AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as size,
  CASE
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 100 THEN 'LOW USAGE'
    ELSE 'ACTIVE'
  END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- ============================================
-- 8. GRANTS AND PERMISSIONS
-- ============================================

-- Grant necessary permissions to filinewall user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO filinewall;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO filinewall;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO filinewall;

-- Grant refresh permissions for materialized views
ALTER MATERIALIZED VIEW daily_call_stats OWNER TO filinewall;
ALTER MATERIALIZED VIEW top_spam_numbers OWNER TO filinewall;
ALTER MATERIALIZED VIEW call_pattern_summary OWNER TO filinewall;

-- ============================================
-- 9. STATISTICS AND ANALYSIS
-- ============================================

-- Update statistics for better query planning
ANALYZE phone_numbers;
ANALYZE call_logs;
ANALYZE spam_reports;
ANALYZE call_patterns;
ANALYZE voice_patterns;
ANALYZE users;

-- ============================================
-- 10. VACUUM AND MAINTENANCE
-- ============================================

-- Full vacuum to optimize database
VACUUM ANALYZE;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check installed extensions
SELECT * FROM pg_extension WHERE extname IN ('pg_trgm', 'btree_gin', 'pg_stat_statements');

-- Check created indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check materialized views
SELECT
  schemaname,
  matviewname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews
WHERE schemaname = 'public';

-- Display completion message
DO $$
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE 'FiLine Wall Database Optimization Complete!';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Extensions installed: pg_trgm, btree_gin';
  RAISE NOTICE 'Performance indexes created: 40+';
  RAISE NOTICE 'Materialized views created: 3';
  RAISE NOTICE 'Maintenance functions created: 3';
  RAISE NOTICE 'Monitoring views created: 3';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Set up cron job to refresh views hourly';
  RAISE NOTICE '2. Run cleanup functions weekly';
  RAISE NOTICE '3. Monitor slow_queries view';
  RAISE NOTICE '4. Check index_usage for unused indexes';
  RAISE NOTICE '======================================';
END $$;
