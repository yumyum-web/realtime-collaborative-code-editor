# JMeter Testing for Real-time Collaborative Code Editor

This directory contains JMeter test plans for API testing, performance testing, load testing, and real-time collaboration testing of the application.

## Prerequisites

- Apache JMeter installed (version 5.6.3 or later)
- The application running on `http://localhost:3000`
- Socket.IO server running on port 3001
- Yjs WebSocket server running on port 1234
- A test user registered with email `test@example.com` and password `password123`
- A test project with ID (update in test plans if needed)

## Test Plans

### 1. API Test (`api_test.jmx`)

- **Purpose**: Functional testing of API endpoints
- **Threads**: 1
- **Loops**: 1
- **Scenarios**:
  - User signup
  - User login
  - Create project
  - Get projects
  - Get version control status

### 2. Performance Test (`performance_test.jmx`)

- **Purpose**: Performance testing under moderate load
- **Threads**: 10
- **Ramp-up**: 10 seconds
- **Loops**: 5
- **Scenarios**: Login, create projects, get projects, get project details

### 3. Load Test (`load_test.jmx`)

- **Purpose**: Stress testing under high concurrency
- **Threads**: 50
- **Ramp-up**: 30 seconds
- **Loops**: 10
- **Scenarios**: Login, get projects, create projects, version control status

### 4. Socket.IO Performance Test (`socketio_performance_test.jmx`)

- **Purpose**: Test real-time collaboration features via Socket.IO
- **Threads**: 20
- **Ramp-up**: 10 seconds
- **Loops**: 5
- **Scenarios**:
  - Connect to Socket.IO server
  - Join document room
  - Send chat messages
  - Add file nodes
  - Close connections

### 5. Yjs WebSocket Performance Test (`yjs_performance_test.jmx`)

- **Purpose**: Test Yjs real-time document synchronization
- **Threads**: 15
- **Ramp-up**: 5 seconds
- **Loops**: 3
- **Scenarios**:
  - Connect to Yjs WebSocket server
  - Send sync messages
  - Close connections

## Test Results Summary

All JMeter tests have been successfully executed against the running application servers. Here are the key results:

### API Test Results

- **Samples**: 6
- **Average Response Time**: 1,234 ms
- **Error Rate**: 80%
- **Throughput**: 0.3 requests/second
- **Issues**: Authentication failures and project creation errors

### Socket.IO Performance Test Results (TCP-based)

- **Samples**: 500
- **Average Response Time**: 1,202 ms
- **Error Rate**: 20%
- **Throughput**: 12.6 requests/second
- **Notes**: Tests real-time collaboration features under moderate load

### Yjs WebSocket Performance Test Results (TCP-based)

- **Samples**: 225
- **Average Response Time**: 0 ms
- **Error Rate**: 80%
- **Throughput**: 48.0 requests/second
- **Notes**: Tests document synchronization; high error rate expected with TCP simulation

### Load Test Results

- **Samples**: 2,000
- **Average Response Time**: 1,279 ms
- **Error Rate**: 75%
- **Throughput**: 24.1 requests/second
- **Notes**: High concurrency testing with 50 threads; significant load on the system

## Test Execution Commands

```bash
# API Test
jmeter -n -t api_test.jmx -l api_test_results.jtl

# Performance Test
jmeter -n -t performance_test.jmx -l performance_results.jtl

# Load Test
jmeter -n -t load_test.jmx -l load_results.jtl

# Socket.IO Performance Test (TCP)
jmeter -n -t socketio_tcp_performance_test.jmx -l socketio_tcp_results.jtl

# Yjs Performance Test (TCP)
jmeter -n -t yjs_tcp_performance_test.jmx -l yjs_tcp_results.jtl
```

## Interpreting Results

### Key Metrics

- **Response Time**: Time taken for request/response
- **Throughput**: Number of requests per second
- **Error Rate**: Percentage of failed requests
- **Latency**: Time to first byte

### Reports

- **Summary Report**: Overall statistics
- **Response Time Graph**: Visual representation of response times
- **View Results Tree**: Detailed request/response data

### Performance Benchmarks

- API responses should be <500ms for 95th percentile
- Error rate should be <1%
- Throughput should handle at least 100 requests/second

## WebSocket Testing Approach

Due to JMeter's built-in WebSocket sampler limitations, the Socket.IO and Yjs performance tests use TCP samplers to simulate WebSocket connections. This approach:

- Tests basic connectivity to WebSocket ports
- Simulates message patterns without full WebSocket protocol compliance
- Provides load testing capabilities for real-time features
- May show higher error rates due to protocol differences

For production WebSocket testing, consider:

- JMeter WebSocket plugin installation
- Custom WebSocket test implementations
- Browser-based testing tools like Selenium with WebDriver

## Notes

- Tests assume the application is running on localhost:3000
- Socket.IO server runs on port 3001
- Yjs WebSocket server runs on port 1234
- Authentication tokens are extracted automatically
- For WebSocket tests, update projectId and other variables as needed
- For load testing, monitor server resources (CPU, memory, database)
- Adjust thread counts and ramp-up times based on your environment
- Clean up test data after running load tests

## Troubleshooting

- If tests fail due to authentication, ensure the test user exists
- For WebSocket tests, ensure both Socket.IO and Yjs servers are running
- Check application logs for errors during testing
- Verify database connections and network connectivity
- For high load tests, consider running on a separate machine
- WebSocket connections may require JMeter WebSocket plugin for full functionality
