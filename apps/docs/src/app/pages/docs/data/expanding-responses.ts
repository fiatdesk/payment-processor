import { DocPage } from './types';
import { NODE_INIT } from './shared';

const EXPANDED_RESPONSE_JSON = `{
  "id": "price_z_yXmLn04Bpw9Wbjx2",
  "object": "price",
  "active": true,
  "currency": "usdc",
  "unit_amount": 1000,
  "product": {
    "id": "prod_z_oJaYlHpf6YmRzCMm",
    "object": "product",
    "name": "Pro Plan",
    "default_price": {
      "id": "price_z_yXmLn04Bpw9Wbjx2",
      "object": "price"
      // ...
    }
    // ...
  }
  // ...
}`;

export const EXPANDING_RESPONSES_PAGE: DocPage = {
  id: 'expanding-responses',
  title: 'Expanding Responses',
  description:
    'Many objects allow you to request additional information as an expanded response by using the expand request parameter. This parameter is available on all API requests, and applies to the response of that request only. You can expand responses in two ways.',
  stripeDocsUrl: 'https://docs.stripe.com/expand',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'In many cases, an object contains the ID of a related object in its response properties. For example, a <code>Price</code> contains the ID of its <code>Product</code> in the <code>product</code> property. You can expand these objects in line with the <code>expand</code> request parameter. The <code>expandable</code> label in this documentation indicates ID fields that you can expand into objects.',
          html: true,
        },
        {
          type: 'paragraph',
          text: "Some available fields aren't included in the responses by default. You can request these fields as an expanded response by using the <code>expand</code> request parameter.",
          html: true,
        },
        {
          type: 'paragraph',
          text: 'You can expand recursively by specifying nested fields after a dot (<code>.</code>). For example, requesting <code>product.default_price</code> on a price expands the <code>product</code> property into a full Product object, then expands the <code>default_price</code> property on that product into a full Price object.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'You can use the <code>expand</code> parameter on any endpoint that returns expandable fields, including list, create, and update endpoints.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Expansions on list requests start with the <code>data</code> property. For example, you can expand <code>data.product</code> on a request to list prices and their associated products. Performing deep expansions on numerous list requests might result in slower processing times.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Expansions have a maximum depth of four levels (for example, <code>data.product.default_price</code> when listing prices).',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'You can expand multiple objects at the same time by identifying multiple items in the <code>expand</code> array.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Stripe equivalent: ',
          text: "The <code>expand</code> parameter behaves exactly like Stripe's. IDs marked <code>expandable</code> can be expanded into full objects, expansions can be nested with a dot, and list expansions begin with the <code>data</code> property.",
          html: true,
        },
        {
          type: 'list',
          items: [
            {
              text: 'API reference: <a href="/prices">Prices API</a>',
              html: true,
            },
            {
              text: 'API reference: <a href="/products">Products API</a>',
              html: true,
            },
          ],
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Expanded request',
          endpoint: { method: 'GET', path: '/v1/prices/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/prices/price_z_yXmLn04Bpw9Wbjx2 \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "expand[]"=product \\
  -d "expand[]"="product.default_price" \\
  -G`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const price = await zoneless.prices.retrieve(
  'price_z_yXmLn04Bpw9Wbjx2',
  {
    expand: ['product', 'product.default_price'],
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: EXPANDED_RESPONSE_JSON,
        },
      ],
    },
  ],
};
