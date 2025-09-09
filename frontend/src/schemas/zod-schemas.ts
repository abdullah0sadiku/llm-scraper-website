import { z } from 'zod';

// News Articles Schema (like HackerNews example)
export const newsArticleSchema = z.object({
  articles: z
    .array(
      z.object({
        title: z.string().describe('Article headline or title'),
        url: z.string().url().describe('Link to the full article'),
        author: z.string().optional().describe('Article author or publisher'),
        publishDate: z.string().optional().describe('Publication date'),
        summary: z.string().optional().describe('Article summary or excerpt'),
        category: z.string().optional().describe('Article category or topic'),
        points: z.number().optional().describe('Points or score (if applicable)'),
        commentsCount: z.number().optional().describe('Number of comments'),
        commentsURL: z.string().url().optional().describe('Link to comments section'),
      })
    )
    .describe('Array of news articles extracted from the webpage'),
});

// E-commerce Product Schema (like Gjirafa50)
export const productSchema = z.object({
  siteTitle: z.string().describe('Main title of the website'),
  siteDescription: z.string().optional().describe('Website description or tagline'),
  products: z.array(z.object({
    name: z.string().describe('Product name'),
    price: z.string().optional().describe('Product price'),
    originalPrice: z.string().optional().describe('Original price if on sale'),
    discount: z.string().optional().describe('Discount percentage or amount'),
    imageUrl: z.string().optional().describe('Product image URL'),
    productUrl: z.string().optional().describe('Link to product page'),
    category: z.string().optional().describe('Product category'),
    brand: z.string().optional().describe('Product brand'),
    availability: z.string().optional().describe('Product availability status'),
    rating: z.string().optional().describe('Product rating if available'),
  })).describe('Products available on the homepage'),
  categories: z.array(z.object({
    name: z.string().describe('Category name'),
    url: z.string().optional().describe('Category URL'),
    productCount: z.number().optional().describe('Number of products in category'),
  })).optional().describe('Product categories'),
  featuredOffers: z.array(z.object({
    title: z.string().describe('Offer title'),
    description: z.string().optional().describe('Offer description'),
    discount: z.string().optional().describe('Discount amount'),
    validUntil: z.string().optional().describe('Offer validity period'),
    url: z.string().optional().describe('Offer URL'),
  })).optional().describe('Featured offers or promotions'),
  navigation: z.array(z.object({
    text: z.string().describe('Navigation item text'),
    url: z.string().optional().describe('Navigation URL'),
    hasSubmenu: z.boolean().optional().describe('Whether item has submenu'),
  })).optional().describe('Main navigation menu items'),
  searchSuggestions: z.array(z.string()).optional().describe('Popular search suggestions'),
  totalProducts: z.number().optional().describe('Total number of products found'),
});

// Job Listings Schema
export const jobListingSchema = z.object({
  jobs: z
    .array(
      z.object({
        title: z.string().describe('Job title or position'),
        company: z.string().describe('Company name'),
        location: z.string().optional().describe('Job location'),
        salary: z.string().optional().describe('Salary range or compensation'),
        description: z.string().optional().describe('Job description'),
        requirements: z.array(z.string()).optional().describe('Job requirements'),
        jobType: z.string().optional().describe('Full-time, Part-time, Contract, etc.'),
        postedDate: z.string().optional().describe('When the job was posted'),
        applicationUrl: z.string().url().describe('Link to apply'),
        remote: z.boolean().optional().describe('Whether job is remote'),
      })
    )
    .describe('Array of job listings extracted from the webpage'),
});

// Contact Information Schema
export const contactSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().describe('Person or organization name'),
        email: z.string().email().optional().describe('Email address'),
        phone: z.string().optional().describe('Phone number'),
        address: z.string().optional().describe('Physical address'),
        website: z.string().url().optional().describe('Website URL'),
        position: z.string().optional().describe('Job title or position'),
        department: z.string().optional().describe('Department or division'),
        socialMedia: z.object({
          linkedin: z.string().url().optional(),
          twitter: z.string().url().optional(),
          facebook: z.string().url().optional(),
        }).optional().describe('Social media profiles'),
      })
    )
    .describe('Array of contact information extracted from the webpage'),
});

// Social Media Posts Schema
export const socialMediaSchema = z.object({
  posts: z
    .array(
      z.object({
        content: z.string().describe('Post content or text'),
        author: z.string().describe('Post author username or name'),
        timestamp: z.string().optional().describe('When the post was created'),
        likes: z.number().optional().describe('Number of likes'),
        shares: z.number().optional().describe('Number of shares'),
        comments: z.number().optional().describe('Number of comments'),
        url: z.string().url().optional().describe('Link to the post'),
        hashtags: z.array(z.string()).optional().describe('Hashtags used in the post'),
        mentions: z.array(z.string()).optional().describe('Users mentioned in the post'),
      })
    )
    .describe('Array of social media posts extracted from the webpage'),
});

// Events Schema
export const eventSchema = z.object({
  events: z
    .array(
      z.object({
        title: z.string().describe('Event name or title'),
        description: z.string().optional().describe('Event description'),
        startDate: z.string().describe('Event start date and time'),
        endDate: z.string().optional().describe('Event end date and time'),
        location: z.string().optional().describe('Event location or venue'),
        organizer: z.string().optional().describe('Event organizer'),
        price: z.string().optional().describe('Ticket price or cost'),
        category: z.string().optional().describe('Event category or type'),
        url: z.string().url().optional().describe('Event page or registration URL'),
        capacity: z.number().optional().describe('Maximum attendees'),
        attendeesCount: z.number().optional().describe('Current number of attendees'),
      })
    )
    .describe('Array of events extracted from the webpage'),
});

// Generic Table Data Schema
export const tableDataSchema = z.object({
  data: z
    .array(
      z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    )
    .describe('Array of table rows with dynamic columns'),
  headers: z.array(z.string()).optional().describe('Table column headers'),
});

// Simple Page Content Schema (like dulla.me example)
export const pageContentSchema = z.object({
  title: z.string().describe('Main title of the page'),
  description: z.string().optional().describe('Page description'),
  sections: z.array(z.object({
    heading: z.string().describe('Section heading'),
    content: z.string().describe('Section content'),
  })).optional().describe('Main content sections'),
  links: z.array(z.object({
    text: z.string().describe('Link text'),
    url: z.string().describe('Link URL'),
  })).optional().describe('Important links on the page'),
  metadata: z.object({
    author: z.string().optional().describe('Page author'),
    publishDate: z.string().optional().describe('Publication date'),
    category: z.string().optional().describe('Content category'),
  }).optional().describe('Page metadata'),
});

// Bank Dashboard Schema
export const bankDashboardSchema = z.object({
  userInfo: z.object({
    username: z.string().describe('Account holder username or name'),
    accountNumber: z.string().optional().describe('Masked account number'),
    lastLogin: z.string().optional().describe('Last login date and time'),
    profileImage: z.string().optional().describe('User profile image URL')
  }).describe('User account information'),
  accountSummary: z.object({
    totalBalance: z.string().describe('Total account balance'),
    availableBalance: z.string().describe('Available balance for spending'),
    currency: z.string().optional().describe('Account currency (USD, EUR, etc.)'),
    accountType: z.string().optional().describe('Account type (Checking, Savings, etc.)')
  }).describe('Account balance and summary'),
  cards: z.array(z.object({
    cardType: z.string().describe('Card type (Credit, Debit, etc.)'),
    cardNumber: z.string().describe('Masked card number (****1234)'),
    cardName: z.string().optional().describe('Card name or nickname'),
    balance: z.string().optional().describe('Card balance or credit limit'),
    expiryDate: z.string().optional().describe('Card expiry date'),
    status: z.string().optional().describe('Card status (Active, Blocked, etc.)')
  })).describe('Bank cards associated with account'),
  recentTransactions: z.array(z.object({
    id: z.string().optional().describe('Transaction ID'),
    date: z.string().describe('Transaction date'),
    description: z.string().describe('Transaction description or merchant name'),
    amount: z.string().describe('Transaction amount with sign (+/-)'),
    category: z.string().optional().describe('Transaction category'),
    status: z.string().optional().describe('Transaction status (Completed, Pending, etc.)'),
    balance: z.string().optional().describe('Account balance after transaction')
  })).describe('Recent transaction history'),
  upcomingPayments: z.array(z.object({
    payee: z.string().describe('Payment recipient'),
    amount: z.string().describe('Payment amount'),
    dueDate: z.string().describe('Payment due date'),
    status: z.string().optional().describe('Payment status'),
    type: z.string().optional().describe('Payment type (Bill, Transfer, etc.)')
  })).optional().describe('Scheduled or upcoming payments'),
  quickActions: z.array(z.object({
    actionName: z.string().describe('Quick action name'),
    actionUrl: z.string().optional().describe('Action URL or link'),
    icon: z.string().optional().describe('Action icon or image'),
    description: z.string().optional().describe('Action description')
  })).optional().describe('Available quick actions (Transfer, Pay Bills, etc.)'),
  notifications: z.array(z.object({
    title: z.string().describe('Notification title'),
    message: z.string().describe('Notification message'),
    date: z.string().optional().describe('Notification date'),
    type: z.string().optional().describe('Notification type (Alert, Info, etc.)'),
    isRead: z.boolean().optional().describe('Whether notification is read')
  })).optional().describe('Account notifications and alerts')
}).describe('Bank dashboard extraction with account info, cards, transactions, and history');

// Registry of all available schemas
export const ZOD_SCHEMAS = {
  news_articles: {
    name: 'News Articles',
    description: 'Extract news articles, blog posts, or similar content',
    schema: newsArticleSchema,
    icon: 'Newspaper',
    examples: ['news.ycombinator.com', 'techcrunch.com', 'bbc.com/news'],
  },
  products: {
    name: 'E-commerce Products',
    description: 'Extract product listings from online stores',
    schema: productSchema,
    icon: 'ShoppingCart',
    examples: ['amazon.com', 'ebay.com', 'shopify stores'],
  },
  jobs: {
    name: 'Job Listings',
    description: 'Extract job postings and career opportunities',
    schema: jobListingSchema,
    icon: 'Briefcase',
    examples: ['linkedin.com/jobs', 'indeed.com', 'glassdoor.com'],
  },
  contacts: {
    name: 'Contact Information',
    description: 'Extract contact details and directory information',
    schema: contactSchema,
    icon: 'Users',
    examples: ['company directories', 'staff pages', 'contact pages'],
  },
  social_media: {
    name: 'Social Media Posts',
    description: 'Extract posts, tweets, and social content',
    schema: socialMediaSchema,
    icon: 'MessageSquare',
    examples: ['twitter.com', 'facebook.com', 'linkedin.com/feed'],
  },
  events: {
    name: 'Events & Meetups',
    description: 'Extract event listings and calendar information',
    schema: eventSchema,
    icon: 'Calendar',
    examples: ['eventbrite.com', 'meetup.com', 'facebook.com/events'],
  },
  table_data: {
    name: 'Table Data',
    description: 'Extract structured data from tables',
    schema: tableDataSchema,
    icon: 'Table',
    examples: ['data tables', 'comparison charts', 'spreadsheet-like content'],
  },
  page_content: {
    name: 'Page Content',
    description: 'Extract general page content with sections and links',
    schema: pageContentSchema,
    icon: 'FileText',
    examples: ['dulla.me', 'personal websites', 'documentation pages'],
  },
  bank_dashboard: {
    name: 'Bank Dashboard',
    description: 'Extract banking information: cards, transactions, balances, user info',
    schema: bankDashboardSchema,
    icon: 'CreditCard',
    examples: ['bank dashboards', 'online banking', 'financial portals'],
  },
} as const;

// Type helpers
export type SchemaType = keyof typeof ZOD_SCHEMAS;
export type SchemaData<T extends SchemaType> = z.infer<typeof ZOD_SCHEMAS[T]['schema']>;

// Utility functions
export function getSchemaByName(name: SchemaType) {
  return ZOD_SCHEMAS[name];
}

export function getAllSchemas() {
  return Object.entries(ZOD_SCHEMAS).map(([key, value]) => ({
    key: key as SchemaType,
    ...value,
  }));
}

export function validateData<T extends SchemaType>(
  data: unknown,
  schemaType: T
): SchemaData<T> {
  const schema = ZOD_SCHEMAS[schemaType].schema;
  return schema.parse(data);
}

// Convert Zod schema to JSON Schema format for the backend
export function zodToJsonSchema(zodSchema: z.ZodSchema): Record<string, any> {
  // Handle ZodObject schemas (like our main schemas)
  if (zodSchema instanceof z.ZodObject) {
    const shape = zodSchema._def.shape;
    const properties: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = convertZodTypeToJsonSchema(value as z.ZodTypeAny);
    }
    
    return {
      type: 'object',
      properties,
      required: Object.keys(shape).filter(key => !isOptional(shape[key] as z.ZodTypeAny))
    };
  }
  
  // Handle other Zod types
  return convertZodTypeToJsonSchema(zodSchema);
}

// Helper function to convert individual Zod types to JSON Schema
function convertZodTypeToJsonSchema(zodType: z.ZodTypeAny): Record<string, any> {
  if (zodType instanceof z.ZodString) {
    const def = zodType._def;
    const schema: any = { type: 'string' };
    
    // Add description if available
    if (def.description) {
      schema.description = def.description;
    }
    
    // Add format for email, url, etc.
    if (def.checks) {
      for (const check of def.checks) {
        if (check.kind === 'email') schema.format = 'email';
        if (check.kind === 'url') schema.format = 'uri';
      }
    }
    
    return schema;
  }
  
  if (zodType instanceof z.ZodNumber) {
    const def = zodType._def;
    const schema: any = { type: 'number' };
    if (def.description) schema.description = def.description;
    return schema;
  }
  
  if (zodType instanceof z.ZodBoolean) {
    const def = zodType._def;
    const schema: any = { type: 'boolean' };
    if (def.description) schema.description = def.description;
    return schema;
  }
  
  if (zodType instanceof z.ZodArray) {
    const def = zodType._def;
    const items = convertZodTypeToJsonSchema(zodType._def.type);
    const schema: any = {
      type: 'array',
      items
    };
    if (def.description) schema.description = def.description;
    return schema;
  }
  
  if (zodType instanceof z.ZodObject) {
    const shape = zodType._def.shape;
    const properties: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = convertZodTypeToJsonSchema(value as z.ZodTypeAny);
    }
    
    return {
      type: 'object',
      properties,
      required: Object.keys(shape).filter(key => !isOptional(shape[key] as z.ZodTypeAny))
    };
  }
  
  if (zodType instanceof z.ZodOptional) {
    return convertZodTypeToJsonSchema(zodType._def.innerType);
  }
  
  if (zodType instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: convertZodTypeToJsonSchema(zodType._def.valueType)
    };
  }
  
  // Default fallback
  return { type: 'string' };
}

// Helper function to check if a Zod type is optional
function isOptional(zodType: z.ZodTypeAny): boolean {
  return zodType instanceof z.ZodOptional || zodType.isOptional();
}
