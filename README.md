# PostForward - Fastly Edge Compute POST Request Forwarder

A high-performance Fastly Edge Compute application that forwards POST requests to a dynamic backend while providing comprehensive request and response logging.

## Features

- **POST Request Forwarding**: Automatically forwards POST requests to a configurable backend
- **Backend Configuration**: Backend URL can be configured directly in the code
- **Comprehensive Logging**: Logs both request and response details to STDOUT
- **Edge-Optimized**: Built for Fastly's Edge Compute platform for maximum performance
- **Error Handling**: Robust error handling with appropriate HTTP status codes
- **JSON Logging**: Structured JSON logging for easy parsing and analysis

## Architecture

This application leverages Fastly's Edge Compute platform to provide:

- **Low Latency**: Requests are processed at the edge, closest to users
- **High Throughput**: Optimized for handling large volumes of requests
- **Minimal Resource Usage**: Efficient memory and CPU utilization
- **Global Distribution**: Automatically distributed across Fastly's global edge network
- **Fastly Logger Integration**: Uses Fastly's native Logger API for optimal performance

## Configuration

### Backend URL Configuration

The backend URL is configured directly in the source code. To change the backend:

1. Open `src/index.js`
2. Locate the `backendUrl` variable (line 18)
3. Update the URL to your desired backend

```javascript
// Configure your backend URL here
const backendUrl = "https://your-backend.com/api";
```

**Default**: `https://httpbin.org/post` (for testing)

### Alternative Configuration Methods

Since Fastly Edge Compute doesn't support environment variables, consider these alternatives:

1. **URL Path-based Routing**: Use different paths to route to different backends
2. **Request Header-based**: Use custom headers to determine the backend
3. **Multiple Deployments**: Deploy different versions with different backend URLs
4. **Configuration File**: Include a separate configuration file in your build

## Usage

### Making Requests

Send POST requests to your deployed Fastly service:

```bash
curl -X POST https://your-service.edgecompute.app/webhook \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from edge!"}'
```

### Request Flow

1. **Request Received**: POST request arrives at Fastly edge
2. **Validation**: Method is validated (only POST allowed)
3. **Logging**: Request details are logged to STDOUT
4. **Forwarding**: Request is forwarded to configured backend
5. **Response Logging**: Response details are logged to STDOUT
6. **Return**: Response is returned to the client

## Logging Format

### Request Log
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "type": "REQUEST",
  "method": "POST",
  "url": "https://your-service.edgecompute.app/webhook",
  "backendUrl": "https://your-backend.com/api",
  "headers": {
    "content-type": "application/json",
    "user-agent": "curl/7.68.0"
  },
  "body": {
    "message": "Hello from edge!"
  }
}
```

### Response Log
```json
{
  "timestamp": "2024-01-15T10:30:01.000Z",
  "type": "RESPONSE",
  "status": 200,
  "statusText": "OK",
  "headers": {
    "content-type": "application/json",
    "content-length": "45"
  },
  "body": {
    "received": "Hello from edge!"
  }
}
```

## Development

### Prerequisites

- Node.js 18+ 
- Fastly CLI (`@fastly/cli`)
- Fastly account with Compute access

**Note**: This project uses Fastly CLI commands directly instead of npm scripts for better control and visibility of the build process.

### Available NPM Scripts (Alternative)

For convenience, the following npm scripts are also available:
- `npm run build` - Builds the application using `fastly compute build`
- `npm run start` - Starts local development server using `fastly compute serve`
- `npm run deploy` - Deploys to Fastly using `fastly compute deploy`

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure backend URL** (optional):
   Edit `src/index.js` and update the `backendUrl` variable if needed.

3. **Start local development server**:
   ```bash
   fastly compute serve
   ```

4. **Test the application**:
   ```bash
   curl -X POST http://localhost:7676/ \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

### Building and Deploying

1. **Build the application**:
   ```bash
   fastly compute build
   ```

2. **Deploy to Fastly**:
   ```bash
   fastly compute deploy
   ```

## Performance Considerations

- **Request Cloning**: Uses `request.clone()` to avoid consuming the request body stream
- **Response Cloning**: Uses `response.clone()` to log response while returning it to client
- **Memory Efficiency**: Processes requests as streams to minimize memory usage
- **Edge Caching**: Leverages Fastly's edge caching capabilities for optimal performance

## Error Handling

- **405 Method Not Allowed**: Returned for non-POST requests
- **500 Internal Server Error**: Returned for processing errors
- **Backend Errors**: Original backend error responses are preserved and forwarded

## Monitoring and Observability

The application provides comprehensive logging that can be used for:

- **Request Tracing**: Track requests through the system
- **Performance Monitoring**: Monitor response times and throughput
- **Error Analysis**: Identify and debug issues
- **Usage Analytics**: Understand traffic patterns and usage

### Log Streaming Options

Fastly Compute provides multiple options for streaming logs:

#### Local Development Logging
For testing and debugging, use Fastly's log-tailing feature to display output directly on your local console:
- [Setting up remote log streaming for Compute](https://www.fastly.com/documentation/guides/integrations/streaming-logs/setting-up-remote-log-streaming-for-compute/) - Complete guide for configuring logging
- No third-party integrations required - perfect for development and testing

#### Production Log Streaming
For production environments, configure third-party logging endpoints:

- **[Google BigQuery Log Streaming](https://www.fastly.com/documentation/guides/integrations/logging-endpoints/log-streaming-google-bigquery/)** - Set up real-time log streaming to BigQuery
- Configure multiple logging endpoints for redundancy
- Automatic log aggregation and analysis

#### BigQuery Data Model
This project includes a BigQuery JSON schema optimized for the logging data:

- **Schema File**: `bigquery_schema.json` - JSON schema for BigQuery API or bq CLI
- **Features**:
  - Partitioned by date for optimal query performance
  - Clustered by log_type and timestamp
  - JSON fields for flexible header and body storage
  - Pre-built views for common log types

**Important**: Before using the schema, replace the placeholders in `bigquery_schema.json`:
- `your-project` → Your Google Cloud Project ID
- `your-dataset` → Your BigQuery Dataset name (e.g., "postforward_logs")

#### Log Configuration Steps
1. **Access Fastly Control Panel**: Log in and select your service
2. **Edit Configuration**: Clone the active version
3. **Add Logging Endpoint**: Click "Logging" → "Create Endpoint"
4. **Configure Endpoint**: Follow the specific endpoint guide (e.g., BigQuery)
5. **Deploy Changes**: Click "Activate" to start logging immediately

**Note**: Logs may take a few moments to appear on your log server after deployment.

## Security

- **Input Validation**: Validates request methods
- **Error Sanitization**: Prevents sensitive information leakage in error responses
- **Header Forwarding**: Preserves original request headers for backend processing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
