import { DocSubSection, DocPage, Attribute } from './types';
import { GetResourceEventAttributes } from './event-types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const PRODUCTS_SUBSECTION: DocSubSection = {
  id: 'products',
  title: 'Products',
  children: [
    { id: 'object', title: 'The Product object' },
    { id: 'create', title: 'Create a product' },
    { id: 'update', title: 'Update a product' },
    { id: 'retrieve', title: 'Retrieve a product' },
    { id: 'list', title: 'List all products' },
    { id: 'delete', title: 'Delete a product' },
  ],
};

// ============================================
// Shared Data
// ============================================
const PRODUCT_OBJECT_JSON = `{
  "id": "prod_z_r3CvnB12vYj7exHh",
  "object": "product",
  "active": true,
  "created": 1778510761,
  "default_price": null,
  "description": null,
  "images": [],
  "marketing_features": [],
  "livemode": false,
  "metadata": {},
  "name": "Pro Plan",
  "package_dimensions": null,
  "shippable": null,
  "statement_descriptor": null,
  "tax_code": null,
  "unit_label": null,
  "updated": 1778510761,
  "url": null,
  "platform_account": "acct_z_Platform123abc",
}`;

const PRODUCT_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless product IDs are prefixed with <code>prod_z_</code>.',
  },
  {
    name: 'active',
    type: 'boolean',
    description: 'Whether the product is currently available for purchase.',
  },
  {
    name: 'default_price',
    type: 'string',
    nullable: true,
    tooltip: {
      label: 'Expandable',
      content:
        'This can be <a href="/expanding_objects">expanded</a> into an object with the <code>expand</code> request parameter.',
    },
    description:
      'The ID of the Price object that is the default price for this product.',
  },
  {
    name: 'description',
    type: 'string',
    nullable: true,
    description:
      "The product's description, meant to be displayable to the customer. Use this field to optionally store a long form explanation of the product being sold for your own rendering purposes.",
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'name',
    type: 'string',
    description: "The product's name, meant to be displayable to the customer.",
  },
  {
    name: 'tax_code',
    type: 'string',
    nullable: true,
    description:
      'A tax code ID. Expandable to the full Tax code object when you use the <code>expand</code> request parameter.',
  },
  {
    name: 'tax_details',
    type: 'object',
    nullable: true,
    description:
      '<strong>Preview feature.</strong> Tax details for this product, including the tax code and an optional performance location.',
    expandable: true,
    children: [
      {
        name: 'performance_location',
        type: 'string',
        nullable: true,
        description:
          'A tax location ID. Depending on the tax code, this is required, optional, or not supported.',
      },
      {
        name: 'tax_code',
        type: 'string',
        nullable: true,
        description: 'A tax code ID.',
      },
    ],
  },
];

const PRODUCT_MORE_ATTRIBUTES: Attribute[] = [
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value.",
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Time at which the object was created. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'images',
    type: 'array of strings',
    description:
      'A list of up to 8 URLs of images for this product, meant to be displayable to the customer.',
  },
  {
    name: 'livemode',
    type: 'boolean',
    description:
      'If the object exists in live mode, the value is <code>true</code>. If the object exists in test mode, the value is <code>false</code>.',
  },
  {
    name: 'marketing_features',
    type: 'array of objects',
    description:
      'A list of up to 15 marketing features for this product. These are displayed in pricing tables.',
    expandable: true,
    children: [
      {
        name: 'name',
        type: 'string',
        nullable: true,
        description: 'The marketing feature name. Up to 80 characters long.',
      },
    ],
  },
  {
    name: 'package_dimensions',
    type: 'object',
    nullable: true,
    description: 'The dimensions of this product for shipping purposes.',
    expandable: true,
    children: [
      {
        name: 'height',
        type: 'float',
        description: 'Height, in inches.',
      },
      {
        name: 'length',
        type: 'float',
        description: 'Length, in inches.',
      },
      {
        name: 'weight',
        type: 'float',
        description: 'Weight, in ounces.',
      },
      {
        name: 'width',
        type: 'float',
        description: 'Width, in inches.',
      },
    ],
  },
  {
    name: 'shippable',
    type: 'boolean',
    nullable: true,
    description: 'Whether this product is shipped (i.e., physical goods).',
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    nullable: true,
    description:
      "Extra information about a product which will appear on your customer's statements. In the case that multiple products are billed at once, the first statement descriptor will be used. Only used for subscription payments.",
  },
  {
    name: 'unit_label',
    type: 'string',
    nullable: true,
    description:
      "A label that represents units of this product. When set, this will be included in customers' receipts, invoices, Checkout, and the customer portal.",
  },
  {
    name: 'updated',
    type: 'timestamp',
    description:
      'Time at which the object was last updated. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'url',
    type: 'string',
    nullable: true,
    description: 'A URL of a publicly-accessible webpage for this product.',
  },
  {
    name: 'platform_account',
    type: 'string',
    description:
      "The platform account that owns this resource. For connected account resources, this is the platform's account ID. For the platform's own resources, this equals the account field (self-referential).",
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It enables multi-tenant operation.",
  },
];

// ============================================
// Pages
// ============================================
export const PRODUCTS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Product object',
  description:
    'Products describe the specific goods or services you offer to your customers. For example, you might offer a Standard and Premium version of your goods or service; each version would be a separate Product. They can be used in conjunction with Prices to configure pricing in Payment Links, Checkout, and Subscriptions.',
  stripeDocsUrl: 'https://docs.stripe.com/api/products',
  endpoints: BuildEndpointSummaries(PRODUCTS_SUBSECTION, [
    { method: 'POST', path: '/v1/products', pageId: 'create' },
    { method: 'POST', path: '/v1/products/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/products/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/products', pageId: 'list' },
    { method: 'DELETE', path: '/v1/products/:id', pageId: 'delete' },
  ]),
  events: GetResourceEventAttributes('product'),
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: PRODUCT_ATTRIBUTES,
          moreAttributes: PRODUCT_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE PRODUCT OBJECT',
          code: PRODUCT_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create Product Parameters
// ============================================
const CREATE_PRODUCT_PARAMETERS: Attribute[] = [
  {
    name: 'name',
    type: 'string',
    required: true,
    description: "The product's name, meant to be displayable to the customer.",
  },
  {
    name: 'active',
    type: 'boolean',
    description:
      'Whether the product is currently available for purchase. Defaults to <code>true</code>.',
  },
  {
    name: 'description',
    type: 'string',
    description:
      "The product's description, meant to be displayable to the customer. Use this field to optionally store a long form explanation of the product being sold for your own rendering purposes.",
  },
  {
    name: 'id',
    type: 'string',
    description:
      'An identifier will be randomly generated by Zoneless. You can optionally override this ID, but the ID must be unique across all products in your Zoneless account.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'tax_code',
    type: 'string',
    description: 'A tax code ID.',
  },
  {
    name: 'tax_details',
    type: 'object',
    description:
      '<strong>Preview feature.</strong> Tax details for this product, including the tax code and an optional performance location.',
    expandable: true,
    children: [
      {
        name: 'performance_location',
        type: 'string',
        description:
          'A tax location ID. Depending on the tax code, this is required, optional, or not supported.',
      },
      {
        name: 'tax_code',
        type: 'string',
        description: 'A tax code ID.',
      },
    ],
  },
];

const CREATE_PRODUCT_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'default_price_data',
    type: 'object',
    description:
      'Data used to generate a new Price object. This Price will be set as the default price for this product. See the <a href="/prices/create">Create a price</a> page for what parameters are available.',
  },
  {
    name: 'images',
    type: 'array of strings',
    description:
      'A list of up to 8 URLs of images for this product, meant to be displayable to the customer.',
  },

  {
    name: 'marketing_features',
    type: 'array of objects',
    description:
      'A list of up to 15 marketing features for this product. These are displayed in pricing tables.',
    children: [
      {
        name: 'name',
        type: 'string',
        required: true,
        description: 'The marketing feature name. Up to 80 characters long.',
      },
    ],
  },
  {
    name: 'package_dimensions',
    type: 'object',
    description: 'The dimensions of this product for shipping purposes.',
    expandable: true,
    children: [
      {
        name: 'height',
        required: true,
        type: 'float',
        description: 'Height, in inches.',
      },
      {
        name: 'length',
        required: true,
        type: 'float',
        description: 'Length, in inches.',
      },
      {
        name: 'weight',
        required: true,
        type: 'float',
        description: 'Weight, in ounces.',
      },
      {
        name: 'width',
        required: true,
        type: 'float',
        description: 'Width, in inches.',
      },
    ],
  },
  {
    name: 'shippable',
    type: 'boolean',
    description: 'Whether this product is shipped (i.e., physical goods).',
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    description:
      "Extra information about a product which will appear on your customer's statements. In the case that multiple products are billed at once, the first statement descriptor will be used. Only used for subscription payments.",
  },
  {
    name: 'unit_label',
    type: 'string',
    description:
      "A label that represents units of this product. When set, this will be included in customers' receipts, invoices, Checkout, and the customer portal. The maximum length is 12 characters.",
  },
  {
    name: 'url',
    type: 'string',
    description: 'A URL of a publicly-accessible webpage for this product.',
  },
];

export const PRODUCTS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a product',
  description: 'Creates a new product object.',
  stripeDocsUrl: 'https://docs.stripe.com/api/products/create',
  endpoints: [{ method: 'POST', path: '/v1/products' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_PRODUCT_PARAMETERS,
          moreAttributes: CREATE_PRODUCT_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Product</code> object if the call succeeds.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/products' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/products \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d name=Pro Plan`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const product = await zoneless.products.create({
  name: 'Pro Plan',
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: PRODUCT_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Create Product Parameters
// ============================================
const UPDATE_PRODUCT_PARAMETERS: Attribute[] = [
  {
    name: 'active',
    type: 'boolean',
    description:
      'Whether the product is currently available for purchase. Defaults to <code>true</code>.',
  },
  {
    name: 'default_price',
    type: 'string',
    description:
      'The ID of the Price object that is the default price for this product.',
  },
  {
    name: 'description',
    type: 'string',
    description:
      "The product's description, meant to be displayable to the customer. Use this field to optionally store a long form explanation of the product being sold for your own rendering purposes.",
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'name',
    type: 'string',
    description: "The product's name, meant to be displayable to the customer.",
  },
  {
    name: 'tax_code',
    type: 'string',
    description: 'A tax code ID.',
  },
  {
    name: 'tax_details',
    type: 'object',
    description:
      '<strong>Preview feature.</strong> Tax details for this product, including the tax code and an optional performance location.',
    expandable: true,
    children: [
      {
        name: 'performance_location',
        type: 'string',
        description:
          'A tax location ID. Depending on the tax code, this is required, optional, or not supported.',
      },
      {
        name: 'tax_code',
        type: 'string',
        description: 'A tax code ID.',
      },
    ],
  },
];

const UPDATE_PRODUCT_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'images',
    type: 'array of strings',
    description:
      'A list of up to 8 URLs of images for this product, meant to be displayable to the customer.',
  },

  {
    name: 'marketing_features',
    type: 'array of objects',
    description:
      'A list of up to 15 marketing features for this product. These are displayed in pricing tables.',
    expandable: true,
    children: [
      {
        name: 'name',
        type: 'string',
        required: true,
        description: 'The marketing feature name. Up to 80 characters long.',
      },
    ],
  },
  {
    name: 'package_dimensions',
    type: 'object',
    description: 'The dimensions of this product for shipping purposes.',
    expandable: true,
    children: [
      {
        name: 'height',
        type: 'float',
        required: true,
        description: 'Height, in inches.',
      },
      {
        name: 'length',
        type: 'float',
        required: true,
        description: 'Length, in inches.',
      },
      {
        name: 'weight',
        type: 'float',
        required: true,
        description: 'Weight, in ounces.',
      },
      {
        name: 'width',
        type: 'float',
        required: true,
        description: 'Width, in inches.',
      },
    ],
  },
  {
    name: 'shippable',
    type: 'boolean',
    description: 'Whether this product is shipped (i.e., physical goods).',
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    description:
      "Extra information about a product which will appear on your customer's statements. In the case that multiple products are billed at once, the first statement descriptor will be used. Only used for subscription payments.",
  },
  {
    name: 'unit_label',
    type: 'string',
    description:
      "A label that represents units of this product. When set, this will be included in customers' receipts, invoices, Checkout, and the customer portal. The maximum length is 12 characters.",
  },
  {
    name: 'url',
    type: 'string',
    description: 'A URL of a publicly-accessible webpage for this product.',
  },
];

export const PRODUCTS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a product',
  description:
    'Updates the specific product by setting the values of the parameters passed. Any parameters not provided will be left unchanged.',
  stripeDocsUrl: 'https://docs.stripe.com/api/products/update',
  endpoints: [{ method: 'POST', path: '/v1/products/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_PRODUCT_PARAMETERS,
          moreAttributes: UPDATE_PRODUCT_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the <code>Product</code> object if the update succeeds.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/products/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/products/prod_z_r3CvnB12vYj7exHh \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d name=Pro Plan`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const product = await zoneless.products.update('prod_z_r3CvnB12vYj7exHh', {
  name: 'Pro Plan',
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: PRODUCT_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Retrieve Product
// ============================================
export const PRODUCTS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a product',
  stripeDocsUrl: 'https://docs.stripe.com/api/products/retrieve',
  description:
    'Retrieves the details of an existing product. Supply the unique product ID from either a product creation request or the product list. Zoneless returns the corresponding product information.',
  endpoints: [{ method: 'GET', path: '/v1/products/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Product</code> object if you provide a valid identifier. Raises an error otherwise.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/products/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/products/prod_z_r3CvnB12vYj7exHh \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const product = await zoneless.products.retrieve('prod_z_r3CvnB12vYj7exHh');`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: PRODUCT_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Delete Product
// ============================================
const DELETE_PRODUCT_RESPONSE_JSON = `{
  "id": "prod_z_r3CvnB12vYj7exHh",
  "object": "product",
  "deleted": true
}`;

export const PRODUCTS_DELETE_PAGE: DocPage = {
  id: 'delete',
  title: 'Delete a product',
  description: 'Deletes an existing product.',
  endpoints: [{ method: 'DELETE', path: '/v1/products/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the deleted <code>Product</code> object with a <code>deleted</code> property set to <code>true</code>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'DELETE', path: '/v1/products/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X DELETE https://api.yourdomain.com/v1/products/prod_z_r3CvnB12vYj7exHh \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const deleted = await zoneless.products.del('prod_z_r3CvnB12vYj7exHh');`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: DELETE_PRODUCT_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// List Products Parameters
// ============================================
const LIST_PRODUCTS_PARAMETERS: Attribute[] = [
  {
    name: 'active',
    type: 'boolean',
    description:
      'Only return products that are active or inactive (e.g., pass <code>false</code> to list all inactive products).',
  },
];

const LIST_PRODUCTS_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'created',
    type: 'object',
    description:
      'A filter on the list based on the <code>created</code> field. The value can be an integer Unix timestamp or a dictionary with filter options.',
    expandable: true,
    children: [
      {
        name: 'gt',
        type: 'integer',
        description: 'Minimum value to filter by (exclusive).',
      },
      {
        name: 'gte',
        type: 'integer',
        description: 'Minimum value to filter by (inclusive).',
      },
      {
        name: 'lt',
        type: 'integer',
        description: 'Maximum value to filter by (exclusive).',
      },
      {
        name: 'lte',
        type: 'integer',
        description: 'Maximum value to filter by (inclusive).',
      },
    ],
  },
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>tu_z_bar</code>, your subsequent call can include <code>ending_before=tu_z_bar</code> in order to fetch the previous page of the list.',
  },
  {
    name: 'ids',
    type: 'array of strings',
    description:
      'Only return products with the given IDs. Cannot be used with starting_after or ending_before.',
  },
  {
    name: 'limit',
    type: 'integer',
    description:
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
  },
  {
    name: 'shippable',
    type: 'boolean',
    description:
      'Only return products that can be shipped (i.e., physical, not digital products).',
  },
  {
    name: 'starting_after',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>tu_z_foo</code>, your subsequent call can include <code>starting_after=tu_z_foo</code> in order to fetch the next page of the list.',
  },
  {
    name: 'url',
    type: 'string',
    description: 'Only return products with the given url.',
  },
];

const LIST_PRODUCTS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/products",
  "has_more": false,
  "data": [
    {
     "id": "prod_z_r3CvnB12vYj7exHh",
     "object": "product",
     "active": true,
     "created": 1778510761,
     "default_price": null,
     "description": null,
     "images": [],
     "marketing_features": [],
     "livemode": false,
     "metadata": {},
     "name": "Pro Plan",
     "package_dimensions": null,
     "shippable": null,
     "statement_descriptor": null,
     "tax_code": null,
     "unit_label": null,
     "updated": 1778510761,
     "url": null,
     "platform_account": "acct_z_Platform123abc",
    }
  ]
}`;

export const PRODUCTS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all products',
  description:
    'Returns a list of products. The products are returned in sorted order, with the most recently created products appearing first.',
  endpoints: [{ method: 'GET', path: '/v1/products' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_PRODUCTS_PARAMETERS,
          moreAttributes: LIST_PRODUCTS_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> products. If no more products are available, the resulting array will be empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/products' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/products \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const products = await zoneless.products.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_PRODUCTS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const PRODUCTS_PAGES: DocPage[] = [
  PRODUCTS_OVERVIEW_PAGE,
  PRODUCTS_CREATE_PAGE,
  PRODUCTS_UPDATE_PAGE,
  PRODUCTS_RETRIEVE_PAGE,
  PRODUCTS_LIST_PAGE,
  PRODUCTS_DELETE_PAGE,
];
