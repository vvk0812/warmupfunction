// Function to fetch the ARN of a Lambda function
const getFunctionArn = async (functionName) => {
    try {
      const params = { FunctionName: functionName };
      const data = await lambda.getFunction(params).promise();
      return data.Configuration.FunctionArn;
    } catch (err) {
      console.error("Error fetching Lambda ARN:", err.message);
      throw new Error(`Could not fetch ARN for function: ${functionName}`);
    }
  };
  
  const checkRecentLogs = async (logGroupName, durationInMinutes) => {
    const durationMs = durationInMinutes * 60 * 1000; // Convert minutes to milliseconds
    const params = {
        logGroupName,
        startTime: Date.now() - durationMs, // Check logs for the last `durationInMinutes`
        endTime: Date.now(),
        limit: 10, // Fetch up to 10 logs
    };
  
    try {
        console.log("Checking logs with params:", params);
        const data = await cloudwatchlogs.filterLogEvents(params).promise();
        console.log("Log Events Data:", JSON.stringify(data));
        return data.events && data.events.length > 0; // Return true if logs exist
    } catch (err) {
        console.error("Error checking recent logs:", err);
        return false;
    }
  };
  
  module.exports.warmupfunction = async (event) => {
    try {
      console.log("Received SQS Event:", JSON.stringify(event));
  
      for (const record of event.Records) {
        const message = JSON.parse(record.body);
        const { functionName, executionTime } = message;
  
        if (!functionName || !executionTime) {
          console.error("Invalid message format. Missing functionName or executionTime:", message);
          continue;
        }
  
        console.log(`Processing function: ${functionName} with executionTime: ${executionTime} mins`);
  
        const logGroupName = `/aws/lambda/${functionName}`;
        const hasRecentLogs = await checkRecentLogs(logGroupName, executionTime);
  
        if (!hasRecentLogs) {
          console.log(`No recent logs found for ${functionName}. Invoking with warmup event.`);
          const functionArn = await getFunctionArn(functionName);
          await lambda
            .invoke({
              FunctionName: functionArn,
              InvocationType: "RequestResponse",
              Payload: JSON.stringify({ warmup: true }),
            })
            .promise();
  
          console.log(`Warmup invocation successful for ${functionName}.`);
        } else {
          console.log(`Recent logs found for ${functionName}. Skipping invocation.`);
        }
      }
  
      return { statusCode: 200, body: "Manager function executed successfully." };
    } catch (err) {
      console.error("Error in Manager Lambda:", err);
      return { statusCode: 500, body: "Internal Server Error" };
    }
  };
  

  module.exports = {
    warmupFunction,
  };
  