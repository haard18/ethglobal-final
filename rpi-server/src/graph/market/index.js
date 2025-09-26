import { createConnectTransport } from "@connectrpc/connect-node";
import { 
  createRegistry, 
  createRequest, 
  streamBlocks, 
  fetchSubstream,
  createAuthInterceptor as createSubstreamsAuthInterceptor 
} from "@substreams/core";
import dotenv from "dotenv";
dotenv.config();
const TOKEN = process.env.GRAPH_API_TOKEN; // Substreams token. By default it takes the SUBSTREAMS_API_TOKEN environment variable of your system
const ENDPOINT = "https://mainnet.eth.streamingfast.io"; // Substreams endpoint. In this case, Ethereum mainnet
const SPKG = "https://spkg.io/streamingfast/ethereum-explorer-v0.1.2.spkg"; // Substreams package. In this case, taken from the substreams.dev registry
const MODULE = "map_block_meta";
const START_BLOCK = "100000";
const STOP_BLOCK = "+10000";

// Function to fetch the substreams package
const fetchPackage = async () => {
  try {
    return await fetchSubstream(SPKG);
  } catch (error) {
    console.error("Error fetching package:", error);
    throw error;
  }
};

// Function to get cursor (for resuming streams)
const getCursor = () => {
  // In a real implementation, this would load the last committed cursor from storage
  return null;
};

// Function to handle block scoped data messages
const handleBlockScopedDataMessage = (blockScopedData, registry) => {
  console.log(`Received block scoped data:`, blockScopedData);
};

// Function to handle block undo signal messages
const handleBlockUndoSignalMessage = (blockUndoSignal) => {
  console.log(`Received block undo signal:`, blockUndoSignal);
};

// Function to handle progress messages
const handleProgressMessage = (progress, registry) => {
  console.log(`Progress:`, progress);
};

// Function to check if error is retryable
const isErrorRetryable = (error) => {
  // Common retryable errors
  return (
    error.code === "UNAVAILABLE" ||
    error.code === "DEADLINE_EXCEEDED" ||
    error.message.includes("connection") ||
    error.message.includes("timeout")
  );
};
export const handleResponseMessage = async (response, registry) => {
    switch(response.message.case) {
        case "blockScopedData":
            handleBlockScopedDataMessage(response.message.value, registry);
            break;

        case "blockUndoSignal":
            handleBlockUndoSignalMessage(response.message.value);
            break;
    }
}
// Main streaming function
const stream = async (pkg, registry, transport) => {
  const request = createRequest({
    substreamPackage: pkg,
    outputModule: MODULE,
    productionMode: true,
    startBlockNum: START_BLOCK,
    stopBlockNum: STOP_BLOCK,
    startCursor: getCursor() ?? undefined,
  });

  // Stream the blocks
  for await (const statefulResponse of streamBlocks(transport, request)) {
    /*
            Decode the response and handle the message.
            There different types of response messages that you can receive. You can read more about the response message in the docs [here](../../../references/reliability-guarantees.md).
        */
    await handleResponseMessage(statefulResponse.response, registry);

    /*
            Handle the progress message.
            Regardless of the response message, the progress message is always sent, and gives you useful information about the execution of the Substreams.
        */
    handleProgressMessage(statefulResponse.progress, registry);
  }
};

/*
    Entrypoint of the application.
    Because of the long-running connection, Substreams will disconnect from time to time.
    The application MUST handle disconnections and commit the provided cursor to avoid missing information.
*/
const main = async () => {
  const pkg = await fetchPackage();
  const registry = createRegistry(pkg);

  // Create gRPC connection
  const transport = createConnectTransport({
    baseUrl: ENDPOINT,
    interceptors: [createSubstreamsAuthInterceptor(TOKEN)],
    useBinaryFormat: true,
    jsonOptions: {
      typeRegistry: registry,
    },
  });

  // The infinite loop handles disconnections. Every time an disconnection error is thrown, the loop will automatically reconnect
  // and start consuming from the latest committed cursor.
  while (true) {
    try {
      await stream(pkg, registry, transport);
    } catch (e) {
      if (!isErrorRetryable(e)) {
        console.log(`A fatal error occurred: ${e}`);
        throw e;
      }
      console.log(`A retryable error occurred (${e}), retrying after backoff`);
      console.log(e);
      // Add backoff from a an easy to use library
    }
  }
};
main();
