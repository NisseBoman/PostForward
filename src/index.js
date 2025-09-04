/// <reference types="@fastly/js-compute" />

import { Logger } from "fastly:logger";
import { env } from "fastly:env";

// Get service version from Fastly environment variable
const SERVICE_VERSION = env("FASTLY_SERVICE_VERSION") || "unknown";

// Create a logger instance
// IMPORTANT: The name "postforward" must match the logging endpoint name configured in Fastly control panel
// To set up logging:
// 1. Go to Fastly control panel → Your Service → Edit Configuration → Logging → Create Endpoint
// 2. Choose your logging provider (e.g., Google BigQuery, Splunk, etc.)
// 3. Name the endpoint "postforward" (or change this code to match your endpoint name)
// 4. Configure the endpoint settings and deploy
const logger = new Logger("postforward");

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const request = event.request;
  
  // Only handle POST requests
  if (request.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405,
      headers: {
        'x-serviceVersion': SERVICE_VERSION
      }
    });
  }

  try {
    // Configure your backend URL here
    const backendUrl = "https://httpbin.org/post";
    
    // Get the request body once
    const requestBody = await request.text();
    
    // Log request details
    logRequestDetails(request, backendUrl, requestBody);
    
    // Forward the request to the backend and get response with body
    const { response, responseBody } = await forwardRequest(request, backendUrl, requestBody);
    
    // Log response details
    logResponseDetails(response, responseBody);
    
    // Add service version header and return response
    return addServiceVersionHeader(response);
  } catch (error) {
    const errorLog = {
      log_id: generateLogId(),
      timestamp: new Date().toISOString(),
      log_type: "REQUEST_ERROR",
      error_message: error.message,
      error_type: "PROCESSING_ERROR",
      created_at: new Date().toISOString(),
      partition_date: new Date().toISOString().split('T')[0]
    };
    const errorMessage = JSON.stringify(errorLog, null, 2);
    logger.log(errorMessage);
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "REQUEST_ERROR",
      error: error.message
    }, null, 2));
    return new Response("Internal Server Error", { 
      status: 500,
      headers: {
        'x-serviceVersion': SERVICE_VERSION
      }
    });
  }
}

function logRequestDetails(request, backendUrl, requestBody) {
  const headers = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key] = value;
  }
  
  let parsedBody;
  try {
    parsedBody = JSON.parse(requestBody);
  } catch {
    parsedBody = requestBody;
  }
  
  // Create log entry matching BigQuery schema
  const logEntry = {
    log_id: generateLogId(),
    timestamp: new Date().toISOString(),
    log_type: "REQUEST",
    request_method: request.method,
    request_url: request.url,
    backend_url: backendUrl,
    request_headers: headers,
    request_body: parsedBody,
    created_at: new Date().toISOString(),
    partition_date: new Date().toISOString().split('T')[0]
  };
  
  const logMessage = JSON.stringify(logEntry, null, 2);
  
  // Validate JSON before logging to prevent truncation issues
  try {
    // Test parse to ensure JSON is valid
    JSON.parse(logMessage);
    
    // Log to Fastly real-time logging (for production) - matches BigQuery schema
    logger.log(logMessage);
  } catch (jsonError) {
    // If JSON is invalid, log a simplified version
    const fallbackLog = {
      log_id: generateLogId(),
      timestamp: new Date().toISOString(),
      log_type: "REQUEST",
      request_method: request.method,
      request_url: request.url,
      backend_url: backendUrl,
      error_message: "JSON serialization failed",
      created_at: new Date().toISOString(),
      partition_date: new Date().toISOString().split('T')[0]
    };
    logger.log(JSON.stringify(fallbackLog, null, 2));
  }
  
  // Also log to STDOUT for local development and log-tailing - human readable format
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    type: "REQUEST",
    method: request.method,
    url: request.url,
    backendUrl: backendUrl,
    headers: headers,
    body: parsedBody
  }, null, 2));
}

// Helper function to generate unique log IDs compatible with BigQuery
function generateLogId() {
  // Create a BigQuery-compatible ID: only alphanumeric characters and hyphens
  // Using a more robust approach to avoid any potential issues
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 11).replace(/[^a-zA-Z0-9]/g, ''); // Ensure only alphanumeric
  return `log-${timestamp}-${randomPart}`;
}

// Helper function to add service version header to responses
function addServiceVersionHeader(response) {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('x-serviceVersion', SERVICE_VERSION);
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

async function forwardRequest(request, backendUrl, requestBody) {
  try {
    // Create a new request for the backend
    const backendRequest = new Request(backendUrl, {
      method: request.method,
      headers: request.headers,
      body: requestBody
    });
    
    // Forward the request to the backend
    const response = await fetch(backendRequest);
    
    // Check if we got a valid response
    if (!response || !response.ok) {
      const errorLog = {
        log_id: generateLogId(),
        timestamp: new Date().toISOString(),
        log_type: "BACKEND_ERROR",
        error_message: `Invalid response from backend: ${backendUrl} - Status: ${response?.status}`,
        error_type: "INVALID_BACKEND_RESPONSE",
        response_status: response?.status,
        created_at: new Date().toISOString(),
        partition_date: new Date().toISOString().split('T')[0]
      };
      const errorMessage = JSON.stringify(errorLog, null, 2);
      
      // Validate JSON before logging
      try {
        JSON.parse(errorMessage);
        logger.log(errorMessage);
      } catch (jsonError) {
        const fallbackLog = {
          log_id: generateLogId(),
          timestamp: new Date().toISOString(),
          log_type: "BACKEND_ERROR",
          error_message: "JSON serialization failed",
          created_at: new Date().toISOString(),
          partition_date: new Date().toISOString().split('T')[0]
        };
        logger.log(JSON.stringify(fallbackLog, null, 2));
      }
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: "BACKEND_ERROR",
        error: `Invalid response from backend: ${backendUrl} - Status: ${response?.status}`
      }, null, 2));
      throw new Error(`Invalid response from backend: ${backendUrl} - Status: ${response?.status}`);
    }
    
    // Get the response body
    const responseBody = await response.text();
    
    // Create a new response with the same body since we consumed it
    const newResponse = new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
    
    return { response: newResponse, responseBody };
  } catch (error) {
    const errorLog = {
      log_id: generateLogId(),
      timestamp: new Date().toISOString(),
      log_type: "FORWARD_ERROR",
      error_message: error.message,
      error_type: "NETWORK_ERROR",
      created_at: new Date().toISOString(),
      partition_date: new Date().toISOString().split('T')[0]
    };
    const errorMessage = JSON.stringify(errorLog, null, 2);
    
    // Validate JSON before logging
    try {
      JSON.parse(errorMessage);
      logger.log(errorMessage);
    } catch (jsonError) {
      const fallbackLog = {
        log_id: generateLogId(),
        timestamp: new Date().toISOString(),
        log_type: "FORWARD_ERROR",
        error_message: "JSON serialization failed",
        created_at: new Date().toISOString(),
        partition_date: new Date().toISOString().split('T')[0]
      };
      logger.log(JSON.stringify(fallbackLog, null, 2));
    }
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "FORWARD_ERROR",
      error: error.message
    }, null, 2));
    
    // Check if it's a network error
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return { 
        response: new Response(`Network error: Unable to reach backend at ${backendUrl}`, { 
          status: 503,
          statusText: "Service Unavailable",
          headers: {
            'x-serviceVersion': SERVICE_VERSION
          }
        }),
        responseBody: `Network error: Unable to reach backend at ${backendUrl}`
      };
    }
    
    // Return a proper error response
    return { 
      response: new Response(`Backend error: ${error.message}`, { 
        status: 502,
        statusText: "Bad Gateway",
        headers: {
          'x-serviceVersion': SERVICE_VERSION
        }
      }),
      responseBody: `Backend error: ${error.message}`
    };
  }
}

async function logResponseDetails(response, responseBody) {
  try {
    const headers = {};
    for (const [key, value] of response.headers.entries()) {
      headers[key] = value;
    }
    
    // Check if response is valid
    if (!response || !response.ok) {
      const errorLog = {
        log_id: generateLogId(),
        timestamp: new Date().toISOString(),
        log_type: "RESPONSE_ERROR",
        error_message: "Invalid response object",
        error_type: "INVALID_RESPONSE",
        response_status: response?.status,
        created_at: new Date().toISOString(),
        partition_date: new Date().toISOString().split('T')[0]
      };
      const errorMessage = JSON.stringify(errorLog, null, 2);
      
      // Validate JSON before logging
      try {
        JSON.parse(errorMessage);
        logger.log(errorMessage);
      } catch (jsonError) {
        const fallbackLog = {
          log_id: generateLogId(),
          timestamp: new Date().toISOString(),
          log_type: "RESPONSE_ERROR",
          error_message: "JSON serialization failed",
          created_at: new Date().toISOString(),
          partition_date: new Date().toISOString().split('T')[0]
        };
        logger.log(JSON.stringify(fallbackLog, null, 2));
      }
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: "RESPONSE_ERROR",
        error: "Invalid response object",
        status: response?.status
      }, null, 2));
      return;
    }
    
    let parsedBody;
    try {
      parsedBody = JSON.parse(responseBody);
    } catch {
      parsedBody = responseBody;
    }
    
    const responseLog = {
      log_id: generateLogId(),
      timestamp: new Date().toISOString(),
      log_type: "RESPONSE",
      response_status: response.status,
      response_status_text: response.statusText,
      response_headers: headers,
      response_body: parsedBody,
      created_at: new Date().toISOString(),
      partition_date: new Date().toISOString().split('T')[0]
    };
    
    const logMessage = JSON.stringify(responseLog, null, 2);
    
    // Validate JSON before logging
    try {
      JSON.parse(logMessage);
      logger.log(logMessage);
    } catch (jsonError) {
      const fallbackLog = {
        log_id: generateLogId(),
        timestamp: new Date().toISOString(),
        log_type: "RESPONSE",
        error_message: "JSON serialization failed",
        created_at: new Date().toISOString(),
        partition_date: new Date().toISOString().split('T')[0]
      };
      logger.log(JSON.stringify(fallbackLog, null, 2));
    }
    
    // Also log to STDOUT for local development and log-tailing - human readable format
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "RESPONSE",
      status: response.status,
      statusText: response.statusText,
      headers: headers,
      body: parsedBody
    }, null, 2));
  } catch (error) {
    const errorLog = {
      log_id: generateLogId(),
      timestamp: new Date().toISOString(),
      log_type: "RESPONSE_LOG_ERROR",
      error_message: error.message,
      error_type: "LOGGING_ERROR",
      created_at: new Date().toISOString(),
      partition_date: new Date().toISOString().split('T')[0]
    };
    const errorLogMessage = JSON.stringify(errorLog, null, 2);
    
    // Validate JSON before logging
    try {
      JSON.parse(errorLogMessage);
      logger.log(errorLogMessage);
    } catch (jsonError) {
      const fallbackLog = {
        log_id: generateLogId(),
        timestamp: new Date().toISOString(),
        log_type: "RESPONSE_LOG_ERROR",
        error_message: "JSON serialization failed",
        created_at: new Date().toISOString(),
        partition_date: new Date().toISOString().split('T')[0]
      };
      logger.log(JSON.stringify(fallbackLog, null, 2));
    }
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "RESPONSE_LOG_ERROR",
      error: error.message
    }, null, 2));
  }
}
