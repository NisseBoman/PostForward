-- BigQuery Schema for PostForward Logs
-- This schema handles all log types: REQUEST, RESPONSE, BACKEND_ERROR, RESPONSE_ERROR, RESPONSE_LOG_ERROR

CREATE TABLE IF NOT EXISTS `se-development-9566.nboman_demo.vladlen_dataset`
(
  -- Common fields for all log types
  log_id STRING NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  log_type STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  partition_date DATE NOT NULL,
  
  -- Request-specific fields (for REQUEST log_type)
  request_method STRING,
  request_url STRING,
  backend_url STRING,
  request_headers JSON,
  request_body TEXT,
  
  -- Response-specific fields (for RESPONSE log_type)
  response_status INT64,
  response_status_text STRING,
  response_headers JSON,
  response_body TEXT,
  
  -- Error-specific fields (for all ERROR log_types)
  error_message STRING,
  error_type STRING
)
PARTITION BY partition_date
CLUSTER BY log_type, timestamp;

-- Example queries to analyze your logs:

-- 1. View all logs from today
SELECT 
  log_id,
  timestamp,
  log_type,
  request_method,
  response_status,
  error_message
FROM `se-development-9566.nboman_demo.vladlen_dataset`
WHERE partition_date = CURRENT_DATE()
ORDER BY timestamp DESC;

-- 2. Count logs by type for the last 7 days
SELECT 
  log_type,
  COUNT(*) as log_count,
  DATE(timestamp) as log_date
FROM `se-development-9566.nboman_demo.vladlen_dataset`
WHERE partition_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY log_type, DATE(timestamp)
ORDER BY log_date DESC, log_count DESC;

-- 3. Find failed requests (4xx and 5xx responses)
SELECT 
  log_id,
  timestamp,
  request_method,
  request_url,
  response_status,
  response_status_text,
  response_body
FROM `se-development-9566.nboman_demo.vladlen_dataset`
WHERE log_type = 'RESPONSE' 
  AND response_status >= 400
  AND partition_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
ORDER BY timestamp DESC;

-- 4. Analyze error patterns
SELECT 
  error_type,
  error_message,
  COUNT(*) as error_count
FROM `se-development-9566.nboman_demo.vladlen_dataset`
WHERE log_type LIKE '%ERROR%'
  AND partition_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY error_type, error_message
ORDER BY error_count DESC;

-- 5. Performance analysis - average response times by endpoint
SELECT 
  request_url,
  COUNT(*) as request_count,
  AVG(TIMESTAMP_DIFF(
    (SELECT timestamp FROM `se-development-9566.nboman_demo.vladlen_dataset` l2 
     WHERE l2.log_type = 'RESPONSE' AND l2.log_id = l1.log_id), 
    l1.timestamp, 
    MILLISECOND
  )) as avg_response_time_ms
FROM `se-development-9566.nboman_demo.vladlen_dataset` l1
WHERE l1.log_type = 'REQUEST'
  AND partition_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
GROUP BY request_url
ORDER BY request_count DESC;

-- 6. Header analysis - most common request headers
SELECT 
  JSON_EXTRACT_SCALAR(request_headers, '$.content_type') as content_type,
  JSON_EXTRACT_SCALAR(request_headers, '$.user_agent') as user_agent,
  COUNT(*) as request_count
FROM `se-development-9566.nboman_demo.vladlen_dataset`
WHERE log_type = 'REQUEST'
  AND partition_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
GROUP BY content_type, user_agent
ORDER BY request_count DESC;

-- 7. Real-time monitoring query (last hour)
SELECT 
  log_type,
  COUNT(*) as count,
  MIN(timestamp) as first_log,
  MAX(timestamp) as last_log
FROM `se-development-9566.nboman_demo.vladlen_dataset`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
GROUP BY log_type
ORDER BY count DESC;

-- 8. Parse JSON from TEXT fields (when needed)
SELECT 
  log_id,
  timestamp,
  request_method,
  request_url,
  -- Parse JSON from TEXT field for analysis
  JSON_EXTRACT_SCALAR(request_body, '$.message') as message_field,
  JSON_EXTRACT_SCALAR(request_body, '$.user_id') as user_id,
  request_body -- Raw TEXT for debugging
FROM `se-development-9566.nboman_demo.vladlen_dataset`
WHERE log_type = 'REQUEST'
  AND partition_date = CURRENT_DATE()
  AND JSON_VALID(request_body) = true -- Only valid JSON
LIMIT 10;
