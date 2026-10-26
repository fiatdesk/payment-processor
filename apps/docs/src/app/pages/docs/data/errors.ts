import { DocPage } from './types';

const ERROR_RESPONSE_JSON = `{
  "error": {
    "message": "Account not found",
    "type": "resource_missing",
    "request_id": "req_z_abc123"
  }
}`;

export const ERRORS_PAGE: DocPage = {
  id: 'errors',
  title: 'Errors',
  description:
    'Zoneless uses conventional HTTP response codes to indicate the success or failure of an API request. Codes in the 2xx range indicate success. Codes in the 4xx range indicate an error given the information provided (e.g., a required parameter was omitted, authentication failed, etc.). Codes in the 5xx range indicate an error with the Zoneless server.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'All errors return a JSON object with an <code>error</code> key containing <code>message</code> and <code>type</code> fields. In production, a <code>request_id</code> is also included for tracing.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: [
            {
              name: 'message',
              type: 'string',
              description:
                'A human-readable message providing more details about the error.',
            },
            {
              name: 'type',
              type: 'enum',
              description: 'The type of error returned.',
              enumValues: [
                {
                  value: 'api_error',
                  description:
                    'Covers any other type of problem (e.g., a temporary problem with the server) and is uncommon.',
                },
                {
                  value: 'authentication_error',
                  description:
                    'Failure to properly authenticate in the request.',
                },
                {
                  value: 'idempotency_error',
                  description:
                    'The idempotency key was reused on a request that is still processing, or was used with different parameters.',
                },
                {
                  value: 'invalid_request_error',
                  description:
                    'The request has invalid parameters or cannot be otherwise served.',
                },
                {
                  value: 'rate_limit_error',
                  description: 'Too many requests hit the API too quickly.',
                },
                {
                  value: 'permission_denied',
                  description:
                    'The API key does not have permission to perform the requested action (e.g., a connected account accessing a platform-only endpoint).',
                },
                {
                  value: 'resource_missing',
                  description: 'The requested resource does not exist.',
                },
                {
                  value: 'validation_error',
                  description: 'A request body field failed schema validation.',
                },
                {
                  value: 'conflict',
                  description:
                    'The request conflicts with another request or the current state of a resource (e.g., creating a duplicate resource).',
                },
              ],
            },
            {
              name: 'request_id',
              type: 'string',
              nullable: true,
              description:
                'A unique identifier for the request, useful for debugging. Only included in production environments.',
            },
          ],
        },
      ],
      right: [
        {
          type: 'object',
          title: 'The error object',
          code: ERROR_RESPONSE_JSON,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'HTTP Status Code Summary' },
        {
          type: 'attributes',
          attributes: [
            {
              name: '200 - OK',
              type: 'status',
              description: 'Everything worked as expected.',
            },
            {
              name: '400 - Bad Request',
              type: 'status',
              description:
                'The request was unacceptable, often due to a missing or invalid parameter.',
            },
            {
              name: '401 - Unauthorized',
              type: 'status',
              description: 'No valid API key provided.',
            },
            {
              name: '403 - Forbidden',
              type: 'status',
              description:
                "The API key doesn't have permissions to perform the request.",
            },
            {
              name: '404 - Not Found',
              type: 'status',
              description: "The requested resource doesn't exist.",
            },
            {
              name: '409 - Conflict',
              type: 'status',
              description:
                'The request conflicts with another request (perhaps due to using the same idempotency key, or creating a duplicate resource).',
            },
            {
              name: '410 - Gone',
              type: 'status',
              description:
                'The requested resource is no longer available (e.g., an account link that has already been used).',
            },
            {
              name: '429 - Too Many Requests',
              type: 'status',
              description:
                'Too many requests hit the API too quickly. We recommend an exponential backoff of your requests.',
            },
            {
              name: '500 - Server Error',
              type: 'status',
              description: 'Something went wrong on the server.',
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Error Types' },
        {
          type: 'attributes',
          attributes: [
            {
              name: 'api_error',
              type: 'type',
              description:
                'Covers any other type of problem (e.g., a temporary problem with the server) and is uncommon.',
            },
            {
              name: 'authentication_error',
              type: 'type',
              description:
                'Failure to properly authenticate in the request. Check that you are providing a valid API key via the <code>x-api-key</code> header or <code>Authorization: Bearer</code> header.',
            },
            {
              name: 'idempotency_error',
              type: 'type',
              description:
                'Occurs when an <code>Idempotency-Key</code> is reused on a request that is still processing, or was previously used with different parameters.',
            },
            {
              name: 'invalid_request_error',
              type: 'type',
              description:
                'The request has invalid parameters, invalid JSON, or cannot be otherwise served.',
            },
            {
              name: 'permission_denied',
              type: 'type',
              description:
                'The API key does not have permission to perform the requested action (e.g., a connected account accessing a platform-only endpoint).',
            },
            {
              name: 'rate_limit_error',
              type: 'type',
              description:
                'Too many requests hit the API too quickly. The response includes <code>Retry-After</code>, <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>, and <code>X-RateLimit-Reset</code> headers.',
            },
            {
              name: 'resource_missing',
              type: 'type',
              description:
                'The requested resource does not exist. Check that the ID you provided is correct and that the resource belongs to your platform.',
            },
            {
              name: 'validation_error',
              type: 'type',
              description:
                'A request body field failed schema validation. The <code>message</code> will include the field path and reason (e.g., <code>email: Invalid email</code>).',
            },
            {
              name: 'conflict',
              type: 'type',
              description:
                'The request conflicts with another request or the current state of a resource (e.g., creating a duplicate resource).',
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Handling errors' },
        {
          type: 'paragraph',
          text: 'The Zoneless Node.js SDK raises exceptions for API errors, letting you handle them with <code>try/catch</code>. The error object contains <code>message</code>, <code>type</code>, and <code>statusCode</code> properties.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Handling errors',
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `# Errors return a JSON body with an "error" key
curl https://api.zoneless.com/v1/accounts/acct_z_invalid \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"

# 404 response:
# {
#   "error": {
#     "message": "Account not found",
#     "type": "resource_missing"
#   }
# }`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `import { Zoneless } from '@zoneless/node';
const zoneless = new Zoneless('sk_live_z_YOUR_API_KEY', 'https://api.zoneless.com');

try {
  const account = await zoneless.accounts.retrieve('acct_z_invalid');
} catch (error) {
  console.log(error.statusCode); // 404
  console.log(error.type);       // "resource_missing"
  console.log(error.message);    // "Account not found"
}`,
            },
          ],
        },
      ],
    },
  ],
};
