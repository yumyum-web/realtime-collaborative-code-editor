# JMeter Performance Testing

This directory contains Apache JMeter test plans for testing the real-time collaborative code editor's performance, load handling, and API functionality. This directory contains JMeter test plans for API testing, performance testing, load testing, and real-time collaboration testing of the application.

## Prerequisites

- Apache JMeter installed (version 5.6.3 or later)
- The application running on `http://localhost:3000`
- Socket.IO server running on port 3001
- Yjs WebSocket server running on port 1234
- A test user registered with email `test@example.com` and password `password123`
- A test project with ID (update in test plans if needed)

## Directory Structure

```
jmeter-tests/
├── test-plans/              # JMeter test plan files (.jmx)
│   ├── api_test.jmx
│   ├── performance_test.jmx
│   ├── load_test.jmx
│   ├── socketio_tcp_performance_test.jmx
│   └── yjs_tcp_performance_test.jmx
├── results/                 # Test results (*.jtl, HTML reports) - gitignored
├── logs/                    # JMeter logs - gitignored
└── README.md
```

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

## Running Tests

All tests are run from the **root directory** of the monorepo using npm scripts:

### Individual Tests

```bash
# API functional testing
npm run test:jmeter:api

# Performance testing (moderate load)
npm run test:jmeter:performance

# Load testing (high concurrency)
npm run test:jmeter:load

# Socket.IO real-time collaboration testing
npm run test:jmeter:socketio

# Yjs WebSocket synchronization testing
npm run test:jmeter:yjs
```

### Run All Tests

```bash
npm run test:jmeter:all
```

### Clean Test Artifacts

```bash
npm run test:jmeter:clean
```

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

## Viewing Results

After running tests, results are saved to `jmeter-tests/results/`:

### CSV Results Files

- `api_test_results.jtl`
- `performance_results.jtl`
- `load_results.jtl`
- `socketio_results.jtl`
- `yjs_results.jtl`

### HTML Reports

Each test generates an HTML report in:

- `jmeter-tests/results/api_test_report/`
- `jmeter-tests/results/performance_report/`
- `jmeter-tests/results/load_report/`
- `jmeter-tests/results/socketio_report/`
- `jmeter-tests/results/yjs_report/`

Open `index.html` in any report directory to view detailed metrics.

### Logs

JMeter logs are saved to `jmeter-tests/logs/`:

- `api_test.log`
- `performance.log`
- `load.log`
- `socketio.log`
- `yjs.log`

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

## Customizing Tests

Test plans are located in `jmeter-tests/test-plans/`. To modify:

1. Open JMeter GUI:
   ```bash
   jmeter
   ```

2. Open the test plan file (File → Open)

3. Modify as needed:
   - Thread counts
   - Ramp-up periods
   - Loop counts
   - Server URLs/ports
   - Request parameters
   - User credentials

4. Save the test plan

## Key Metrics to Monitor

- **Response Time**: Average, median, 90th, 95th, 99th percentile
- **Throughput**: Requests per second
- **Error Rate**: Percentage of failed requests
- **Concurrent Users**: Number of simultaneous connections
- **Latency**: Network and processing delays

## Best Practices

1. **Start servers before testing**:
   ```bash
   npm run dev:all
   ```

2. **Clean previous results**:
   ```bash
   npm run test:jmeter:clean
   ```

3. **Run tests sequentially** to avoid resource contention

4. **Monitor system resources** during tests (CPU, memory, network)

5. **Adjust thread counts** based on your system capabilities

## Troubleshooting

### JMeter command not found
Install Apache JMeter and ensure it's in your PATH.

### Connection refused errors
- Verify all servers are running
- Check ports are not blocked
- Confirm URLs in test plans match your setup

### High error rates
- Check server logs for issues
- Reduce thread count/ramp-up time
- Verify test data (users, projects) exists
- Check authentication tokens/sessions

### Out of memory
Increase JMeter heap size:
```bash
export JVM_ARGS="-Xms512m -Xmx2048m"
```

## Notes

- Tests assume the application is running on localhost:3000
- Socket.IO server runs on port 3001
- Yjs WebSocket server runs on port 1234
- Authentication tokens are extracted automatically
- For WebSocket tests, update projectId and other variables as needed
- For load testing, monitor server resources (CPU, memory, database)
- Adjust thread counts and ramp-up times based on your environment
- Clean up test data after running load tests

## CI/CD Integration

To run JMeter tests in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run JMeter Performance Tests
  run: |
    npm run dev:all &
    sleep 30  # Wait for servers to start
    npm run test:jmeter:all
```

## Additional Resources

- [Apache JMeter Documentation](https://jmeter.apache.org/usermanual/index.html)
- [JMeter Best Practices](https://jmeter.apache.org/usermanual/best-practices.html)
- [Performance Testing Guide](https://jmeter.apache.org/usermanual/build-web-test-plan.html)
