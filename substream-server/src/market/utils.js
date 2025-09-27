import axios from 'axios';

const GRAPH_TOKEN_API = {
  endpoint: 'https://token-api.thegraph.com',
  token: process.env.GRAPH_API_TOKEN || "eyJhbGciOiJLTVNFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3OTQ4OTU2MTksImp0aSI6IjgwMjllZDg4LTY5ZWMtNDA2NC05OWFhLWFkNGY2ZDU0NWUwMiIsImlhdCI6MTc1ODg5NTYxOSwiaXNzIjoiZGZ1c2UuaW8iLCJzdWIiOiIwZGl6YTM4NWM5MmVhOTkzZGRhODIiLCJ2IjoyLCJha2kiOiIzMDVhZWZkNDE3YmJjNzgyNzAyY2FkN2IxMGViMzlkMTBlNTdiNWQ4MTU5M2ZkYTg2YWY4Yzk5YjljN2EwMDY0IiwidWlkIjoiMGRpemEzODVjOTJlYTk5M2RkYTgyIiwic3Vic3RyZWFtc19wbGFuX3RpZXIiOiJGUkVFIiwiY2ZnIjp7IlNVQlNUUkVBTVNfTUFYX1JFUVVFU1RTIjoiMiIsIlNVQlNUUkVBTVNfUEFSQUxMRUxfSk9CUyI6IjUiLCJTVUJTVFJFQU1TX1BBUkFMTEVMX1dPUktFUlMiOiI1In19.-BBfME1q4KdqXs4tmFstcwfJYDPxvT1Zl4RMfVlh29jDbzQHNIJA3OhT7NQsMDwNVEn0POHCHWHdpfCrOrgGHA"
};

export const graphTokenApiRequest = async (path, params = {}) => {
  try {
    const response = await axios.get(`${GRAPH_TOKEN_API.endpoint}${path}`, {
      params: {
        network_id: 'mainnet',
        ...params
      },
      headers: {
        Authorization: `Bearer ${GRAPH_TOKEN_API.token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Token API error:', error);
    throw new Error(`Failed to execute request: ${error.message}`);
  }
};
