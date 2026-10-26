import { DocPage } from './types';
import { NODE_INIT } from './shared';

const LIST_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/accounts",
  "has_more": false,
  "data": [
    {
      "id": "acct_z_1Nv0FGQ9RKHgCVdK",
      "object": "account",
      "business_type": "individual",
      "country": "US",
      "created": 1704067200,
      "default_currency": "usdc",
      "email": "seller@example.com",
      "details_submitted": true,
      "charges_enabled": true,
      "payouts_enabled": true
    }
  ]
}`;

export const PAGINATION_PAGE: DocPage = {
  id: 'pagination',
  title: 'Pagination',
  description:
    'All top-level API resources have support for bulk fetches through "list" API methods. For example, you can list accounts, list transfers, and list payouts. These list API methods share a common structure and accept, at a minimum, the following three parameters: limit, starting_after, and ending_before.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: "Zoneless's list API methods use cursor-based pagination through the <code>starting_after</code> and <code>ending_before</code> parameters. Both parameters accept an existing object ID value (see below) and return objects in reverse chronological order. The <code>ending_before</code> parameter returns objects listed before the named object. The <code>starting_after</code> parameter returns objects listed after the named object. These parameters are mutually exclusive — you can use either <code>starting_after</code> or <code>ending_before</code>, but not both simultaneously.",
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: [
            {
              name: 'limit',
              type: 'integer',
              description:
                'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
            },
            {
              name: 'starting_after',
              type: 'string',
              description:
                'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For example, if you make a list request and receive 100 objects, ending with <code>acct_z_foo</code>, your subsequent call can include <code>starting_after=acct_z_foo</code> to fetch the next page of the list.',
            },
            {
              name: 'ending_before',
              type: 'string',
              description:
                'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For example, if you make a list request and receive 100 objects, starting with <code>acct_z_bar</code>, your subsequent call can include <code>ending_before=acct_z_bar</code> to fetch the previous page of the list.',
            },
          ],
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Paginated request',
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/accounts \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3 \\
  -d starting_after=acct_z_1Nv0FGQ9RKHgCVdK`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const accounts = await zoneless.accounts.list({
  limit: 3,
  starting_after: 'acct_z_1Nv0FGQ9RKHgCVdK',
});`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'List Response Format' },
        {
          type: 'attributes',
          attributes: [
            {
              name: 'object',
              type: 'string',
              description:
                'The type of this response. Always <code>"list"</code>.',
            },
            {
              name: 'data',
              type: 'array',
              description:
                'An array containing the actual response elements, paginated by any request parameters.',
            },
            {
              name: 'has_more',
              type: 'boolean',
              description:
                'Whether or not there are more elements available after this set. If <code>false</code>, this set comprises the end of the list.',
            },
            {
              name: 'url',
              type: 'string',
              description: 'The URL path for accessing this list.',
            },
          ],
        },
      ],
      right: [
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_RESPONSE_JSON,
        },
      ],
    },
  ],
};
