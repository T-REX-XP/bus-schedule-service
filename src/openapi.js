/**
 * OpenAPI/Swagger specification for EMT Valencia Bus API
 */

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: '🚍 EMT Valencia Bus Schedule API',
    description: `
Public microservice providing upcoming bus departures for EMT Valencia based on GTFS open data.

## Data Source
This API uses official GTFS data from Valencia's Open Data Portal:
- **Source**: [opendata.vlci.valencia.es](https://opendata.vlci.valencia.es/)
- **Dataset**: EMT Valencia - Google Transit (GTFS)
- **License**: CC-BY 4.0

## Features
- 🔍 Search for bus stops by name or location
- 🚌 Find bus routes by number or name
- ⏰ Get upcoming departures
- 📍 Location-based search with distance calculation
- 💾 Automatic GTFS data caching (6 hour TTL)
`,
    version: '1.0.0',
    contact: {
      name: 'Valencia Bus API',
      url: 'https://opendata.vlci.valencia.es/',
    },
    license: {
      name: 'CC-BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
  },
  servers: [
    {
      url: 'http://localhost:8787',
      description: 'Local development server',
    },
    {
      url: 'https://emt-valencia-bus-api.workers.dev',
      description: 'Production server',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'API health and status endpoints',
    },
    {
      name: 'Stops',
      description: 'Bus stop information and search',
    },
    {
      name: 'Routes',
      description: 'Bus route information and search',
    },
    {
      name: 'Departures',
      description: 'Real-time departure information',
    },
  ],
  paths: {
    '/': {
      get: {
        tags: ['Health'],
        summary: 'API Status',
        description: 'Get API status and available endpoints',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'running' },
                    service: { type: 'string', example: 'EMT Valencia Bus Schedule API' },
                    version: { type: 'string', example: '1.0.0' },
                    endpoints: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/gtfs-status': {
      get: {
        tags: ['Health'],
        summary: 'GTFS Data Source Status',
        description: 'Check if the GTFS data source is accessible',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['available', 'unavailable', 'error'] },
                    url: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/routes': {
      get: {
        tags: ['Routes'],
        summary: 'List all bus routes',
        description: 'Returns a list of all bus routes in the GTFS feed, optionally filtered by search term',
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Filter routes by route ID, short name, or long name (case-insensitive)',
            required: false,
            schema: { type: 'string' },
            example: '25',
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer' },
                    filter: { type: 'string', nullable: true },
                    routes: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          route_id: { type: 'string' },
                          route_short_name: { type: 'string' },
                          route_long_name: { type: 'string' },
                          route_type: { type: 'string' },
                          route_color: { type: 'string' },
                          route_text_color: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Service unavailable',
          },
        },
      },
    },
    '/stops': {
      get: {
        tags: ['Stops'],
        summary: 'List all bus stops',
        description: 'Returns a list of all bus stops in the GTFS feed, optionally filtered by name',
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Filter stops by name (case-insensitive)',
            required: false,
            schema: { type: 'string' },
            example: 'plaza',
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer' },
                    filter: { type: 'string', nullable: true },
                    stops: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          stop_id: { type: 'string' },
                          name: { type: 'string' },
                          lat: { type: 'string' },
                          lon: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/find-stop': {
      get: {
        tags: ['Stops'],
        summary: 'Find stop by name or location',
        description: 'Search for bus stops by name or find stops near a specific location',
        parameters: [
          {
            name: 'name',
            in: 'query',
            description: 'Search term to filter stops by name',
            required: false,
            schema: { type: 'string' },
            example: 'plaza ayuntamiento',
          },
          {
            name: 'lat',
            in: 'query',
            description: 'Latitude for location-based search',
            required: false,
            schema: { type: 'number', format: 'float', minimum: -90, maximum: 90 },
            example: 39.4699,
          },
          {
            name: 'lon',
            in: 'query',
            description: 'Longitude for location-based search',
            required: false,
            schema: { type: 'number', format: 'float', minimum: -180, maximum: 180 },
            example: -0.3763,
          },
          {
            name: 'radius',
            in: 'query',
            description: 'Search radius in meters (default: 500)',
            required: false,
            schema: { type: 'integer', minimum: 50, maximum: 5000, default: 500 },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of results to return',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer' },
                    search_criteria: { type: 'object' },
                    stops: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          stop_id: { type: 'string' },
                          name: { type: 'string' },
                          location: {
                            type: 'object',
                            properties: {
                              lat: { type: 'number' },
                              lon: { type: 'number' },
                            },
                          },
                          distance_meters: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/find-route': {
      get: {
        tags: ['Routes'],
        summary: 'Find route by number or name',
        description: 'Search for bus routes by route number, short name, or long name',
        parameters: [
          {
            name: 'number',
            in: 'query',
            description: 'Route number or short name',
            required: false,
            schema: { type: 'string' },
            example: '25',
          },
          {
            name: 'name',
            in: 'query',
            description: 'Search term to filter routes by long name',
            required: false,
            schema: { type: 'string' },
            example: 'centro',
          },
          {
            name: 'include_stops',
            in: 'query',
            description: 'Include list of stops served by the route',
            required: false,
            schema: { type: 'boolean', default: false },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of results to return',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
          },
        },
      },
    },
    '/departures': {
      get: {
        tags: ['Departures'],
        summary: 'Get upcoming departures',
        description: 'Returns the next scheduled departures for a specific route and stop',
        parameters: [
          {
            name: 'route_id',
            in: 'query',
            description: 'Route ID',
            required: true,
            schema: { type: 'string' },
            example: '25',
          },
          {
            name: 'stop_id',
            in: 'query',
            description: 'Stop ID',
            required: true,
            schema: { type: 'string' },
            example: '1234',
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of upcoming departures to return',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    route_id: { type: 'string' },
                    stop_id: { type: 'string' },
                    departures: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          departure_time: { type: 'string', example: '14:30:00' },
                          trip_id: { type: 'string' },
                          stop_sequence: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request - missing required parameters',
          },
        },
      },
    },
  },
};
