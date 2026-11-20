// Technology signals: how to recognise a technology in a project, and what to
// search skills.sh for when we find it.
//
// Fields
//   id        stable tag id
//   label     human name
//   cat       language | framework | frontend | mobile | styling | orm | database |
//             migrations | cache | messaging | search | api | testing | infra |
//             cloud | ci | ai | auth | monorepo | build
//   npm/maven/pypi/go/cargo/gem/composer/nuget/pub/hex
//             dependency names. npm entries are exact names (a trailing * means prefix).
//             Other ecosystems are matched against the manifest text (lower-cased,
//             "_" treated as "-"), with a left word boundary. Prefix an entry with
//             "re:" to give a raw regular expression instead.
//   images    docker image name fragments (docker-compose / Dockerfile FROM)
//   q         skills.sh search queries for this technology
//
// Keep queries short: skills.sh runs fuzzy search for one word and semantic
// search for several words.

export const SIGNALS = [
  // ---------- languages ----------
  { id: 'typescript', label: 'TypeScript', cat: 'language', npm: ['typescript'], q: ['typescript'] },
  { id: 'javascript', label: 'JavaScript', cat: 'language', q: ['javascript'] },
  { id: 'java', label: 'Java', cat: 'language', q: ['java'] },
  { id: 'kotlin', label: 'Kotlin', cat: 'language', maven: ['kotlin-stdlib', 're:org\\.jetbrains\\.kotlin'], q: ['kotlin'] },
  { id: 'python', label: 'Python', cat: 'language', q: ['python'] },
  { id: 'go', label: 'Go', cat: 'language', q: ['golang'] },
  { id: 'rust', label: 'Rust', cat: 'language', q: ['rust'] },
  { id: 'ruby', label: 'Ruby', cat: 'language', q: ['ruby'] },
  { id: 'php', label: 'PHP', cat: 'language', q: ['php'] },
  { id: 'csharp', label: 'C# / .NET', cat: 'language', q: ['dotnet', 'csharp'] },
  { id: 'dart', label: 'Dart', cat: 'language', q: ['dart'] },
  { id: 'elixir', label: 'Elixir', cat: 'language', q: ['elixir'] },
  { id: 'swift', label: 'Swift', cat: 'language', q: ['swift'] },
  { id: 'scala', label: 'Scala', cat: 'language', q: ['scala'] },

  // ---------- backend frameworks ----------
  { id: 'spring-boot', label: 'Spring Boot', cat: 'framework', maven: ['spring-boot', 'org.springframework.boot'], q: ['spring boot'] },
  { id: 'spring-cloud', label: 'Spring Cloud', cat: 'framework', maven: ['spring-cloud'], q: ['spring cloud microservices'] },
  { id: 'webflux', label: 'Spring WebFlux', cat: 'framework', maven: ['spring-boot-starter-webflux', 'spring-webflux'], q: ['reactive spring webflux'] },
  { id: 'quarkus', label: 'Quarkus', cat: 'framework', maven: ['io.quarkus', 'quarkus-'], q: ['quarkus'] },
  { id: 'micronaut', label: 'Micronaut', cat: 'framework', maven: ['io.micronaut'], q: ['micronaut'] },
  { id: 'ktor', label: 'Ktor', cat: 'framework', maven: ['io.ktor'], q: ['ktor'] },
  { id: 'express', label: 'Express', cat: 'framework', npm: ['express'], q: ['express'] },
  { id: 'nestjs', label: 'NestJS', cat: 'framework', npm: ['@nestjs/core'], q: ['nestjs'] },
  { id: 'fastify', label: 'Fastify', cat: 'framework', npm: ['fastify'], q: ['fastify'] },
  { id: 'hono', label: 'Hono', cat: 'framework', npm: ['hono'], q: ['hono'] },
  { id: 'django', label: 'Django', cat: 'framework', pypi: ['django'], q: ['django'] },
  { id: 'fastapi', label: 'FastAPI', cat: 'framework', pypi: ['fastapi'], q: ['fastapi'] },
  { id: 'flask', label: 'Flask', cat: 'framework', pypi: ['flask'], q: ['flask'] },
  { id: 'gin', label: 'Gin', cat: 'framework', go: ['github.com/gin-gonic/gin'], q: ['gin golang'] },
  { id: 'echo', label: 'Echo', cat: 'framework', go: ['github.com/labstack/echo'], q: ['echo golang'] },
  { id: 'fiber', label: 'Fiber', cat: 'framework', go: ['github.com/gofiber/fiber'], q: ['fiber golang'] },
  { id: 'axum', label: 'Axum', cat: 'framework', cargo: ['axum'], q: ['axum'] },
  { id: 'actix', label: 'Actix', cat: 'framework', cargo: ['actix-web'], q: ['actix'] },
  { id: 'tokio', label: 'Tokio', cat: 'framework', cargo: ['tokio'], q: ['tokio async rust'] },
  { id: 'rails', label: 'Ruby on Rails', cat: 'framework', gem: ['rails'], q: ['rails'] },
  { id: 'laravel', label: 'Laravel', cat: 'framework', composer: ['laravel/framework'], q: ['laravel'] },
  { id: 'symfony', label: 'Symfony', cat: 'framework', composer: ['symfony/framework-bundle'], q: ['symfony'] },
  { id: 'aspnet', label: 'ASP.NET Core', cat: 'framework', nuget: ['microsoft.aspnetcore'], q: ['asp.net core'] },
  { id: 'phoenix', label: 'Phoenix', cat: 'framework', hex: [':phoenix'], q: ['phoenix elixir'] },

  // ---------- frontend ----------
  { id: 'nextjs', label: 'Next.js', cat: 'frontend', npm: ['next'], q: ['nextjs'] },
  { id: 'react', label: 'React', cat: 'frontend', npm: ['react'], q: ['react'] },
  { id: 'vue', label: 'Vue', cat: 'frontend', npm: ['vue'], q: ['vue'] },
  { id: 'nuxt', label: 'Nuxt', cat: 'frontend', npm: ['nuxt'], q: ['nuxt'] },
  { id: 'angular', label: 'Angular', cat: 'frontend', npm: ['@angular/core'], q: ['angular'] },
  { id: 'svelte', label: 'Svelte', cat: 'frontend', npm: ['svelte', '@sveltejs/kit'], q: ['svelte'] },
  { id: 'remix', label: 'Remix / React Router', cat: 'frontend', npm: ['@remix-run/react', '@react-router/dev'], q: ['remix react router'] },
  { id: 'astro', label: 'Astro', cat: 'frontend', npm: ['astro'], q: ['astro'] },
  { id: 'solid', label: 'SolidJS', cat: 'frontend', npm: ['solid-js'], q: ['solidjs'] },
  { id: 'vite', label: 'Vite', cat: 'build', npm: ['vite'], q: ['vite'] },
  { id: 'storybook', label: 'Storybook', cat: 'frontend-lib', npm: ['storybook', '@storybook/*'], q: ['storybook'] },
  { id: 'tanstack-query', label: 'TanStack Query', cat: 'frontend-lib', npm: ['@tanstack/react-query'], q: ['tanstack query'] },
  { id: 'redux', label: 'Redux', cat: 'frontend-lib', npm: ['@reduxjs/toolkit', 'redux'], q: ['redux'] },
  { id: 'zustand', label: 'Zustand', cat: 'frontend-lib', npm: ['zustand'], q: ['zustand'] },

  // ---------- styling / ui ----------
  { id: 'tailwind', label: 'Tailwind CSS', cat: 'styling', npm: ['tailwindcss'], q: ['tailwind'] },
  { id: 'shadcn', label: 'shadcn/ui / Radix', cat: 'styling', npm: ['@radix-ui/*'], files: ['components.json'], q: ['shadcn'] },
  { id: 'mui', label: 'Material UI', cat: 'styling', npm: ['@mui/material'], q: ['material ui'] },

  // ---------- mobile ----------
  { id: 'react-native', label: 'React Native', cat: 'mobile', npm: ['react-native'], q: ['react native'] },
  { id: 'expo', label: 'Expo', cat: 'mobile', npm: ['expo'], q: ['expo'] },
  { id: 'flutter', label: 'Flutter', cat: 'mobile', pub: ['flutter:'], q: ['flutter'] },
  { id: 'android', label: 'Android', cat: 'mobile', maven: ['com.android.application', 'com.android.tools.build', 'androidx.'], q: ['android'] },
  { id: 'swiftui', label: 'SwiftUI / iOS', cat: 'mobile', q: ['swiftui', 'ios'] },

  // ---------- orm / data access ----------
  { id: 'prisma', label: 'Prisma', cat: 'orm', npm: ['prisma', '@prisma/client'], q: ['prisma'] },
  { id: 'drizzle', label: 'Drizzle', cat: 'orm', npm: ['drizzle-orm'], q: ['drizzle orm'] },
  { id: 'typeorm', label: 'TypeORM', cat: 'orm', npm: ['typeorm'], q: ['typeorm'] },
  { id: 'jpa', label: 'JPA / Hibernate', cat: 'orm', maven: ['spring-boot-starter-data-jpa', 'hibernate-core', 'org.hibernate', 'jakarta.persistence'], q: ['jpa hibernate'] },
  { id: 'jooq', label: 'jOOQ', cat: 'orm', maven: ['org.jooq'], q: ['jooq'] },
  { id: 'sqlalchemy', label: 'SQLAlchemy', cat: 'orm', pypi: ['sqlalchemy'], q: ['sqlalchemy'] },
  { id: 'gorm', label: 'GORM', cat: 'orm', go: ['gorm.io/gorm'], q: ['gorm'] },
  { id: 'efcore', label: 'Entity Framework', cat: 'orm', nuget: ['microsoft.entityframeworkcore'], q: ['entity framework'] },
  { id: 'supabase', label: 'Supabase', cat: 'database', npm: ['@supabase/supabase-js', '@supabase/ssr'], pypi: ['supabase'], files: ['supabase/config.toml'], q: ['supabase'] },
  { id: 'firebase', label: 'Firebase', cat: 'database', npm: ['firebase', 'firebase-admin'], files: ['firebase.json'], q: ['firebase'] },

  // ---------- databases ----------
  { id: 'postgres', label: 'PostgreSQL', cat: 'database', npm: ['pg', 'postgres', '@neondatabase/serverless'], maven: ['org.postgresql', 'r2dbc-postgresql'], pypi: ['psycopg', 'psycopg2', 'psycopg2-binary', 'asyncpg'], go: ['github.com/lib/pq', 'github.com/jackc/pgx'], cargo: ['tokio-postgres', 're:sqlx.*postgres'], gem: ['pg'], nuget: ['npgsql'], images: ['postgres', 'postgis', 'timescale'], q: ['postgres'] },
  { id: 'mysql', label: 'MySQL / MariaDB', cat: 'database', npm: ['mysql', 'mysql2'], maven: ['mysql-connector', 'mariadb-java-client'], pypi: ['pymysql', 'mysqlclient'], go: ['github.com/go-sql-driver/mysql'], gem: ['mysql2'], images: ['mysql', 'mariadb'], q: ['mysql'] },
  { id: 'mongodb', label: 'MongoDB', cat: 'database', npm: ['mongodb', 'mongoose'], maven: ['mongodb-driver', 'spring-boot-starter-data-mongodb'], pypi: ['pymongo', 'motor', 'beanie'], go: ['go.mongodb.org/mongo-driver'], images: ['mongo'], q: ['mongodb'] },
  { id: 'sqlite', label: 'SQLite', cat: 'database', npm: ['better-sqlite3', 'sqlite3', '@libsql/client'], q: ['sqlite'] },
  { id: 'dynamodb', label: 'DynamoDB', cat: 'database', npm: ['@aws-sdk/client-dynamodb'], maven: ['dynamodb'], q: ['dynamodb'] },
  { id: 'cassandra', label: 'Cassandra', cat: 'database', maven: ['cassandra'], images: ['cassandra', 'scylla'], q: ['cassandra'] },
  { id: 'neo4j', label: 'Neo4j', cat: 'database', npm: ['neo4j-driver'], maven: ['neo4j'], pypi: ['neo4j'], images: ['neo4j'], q: ['neo4j graph database'] },
  { id: 'vector-db', label: 'Vector DB', cat: 'database', npm: ['@pinecone-database/pinecone', 'pgvector'], pypi: ['pinecone', 'qdrant-client', 'chromadb', 'weaviate-client', 'pgvector'], images: ['qdrant', 'chroma', 'weaviate'], q: ['vector database'] },

  // ---------- migrations ----------
  { id: 'flyway', label: 'Flyway', cat: 'migrations', maven: ['flyway'], q: ['database migrations'] },
  { id: 'liquibase', label: 'Liquibase', cat: 'migrations', maven: ['liquibase'], q: ['liquibase'] },
  { id: 'alembic', label: 'Alembic', cat: 'migrations', pypi: ['alembic'], files: ['alembic.ini'], q: ['alembic migrations'] },

  // ---------- cache / messaging / search ----------
  { id: 'redis', label: 'Redis', cat: 'cache', npm: ['redis', 'ioredis', '@upstash/redis'], maven: ['spring-boot-starter-data-redis', 'jedis', 'lettuce', 'redisson'], pypi: ['redis'], go: ['github.com/redis/go-redis', 'github.com/go-redis/redis'], gem: ['redis'], images: ['redis', 'valkey'], q: ['redis'] },
  { id: 'kafka', label: 'Kafka', cat: 'messaging', npm: ['kafkajs'], maven: ['kafka'], pypi: ['kafka-python', 'confluent-kafka', 'aiokafka'], go: ['github.com/segmentio/kafka-go', 'github.com/confluentinc/confluent-kafka-go', 'github.com/ibm/sarama'], images: ['kafka', 'redpanda'], q: ['kafka'] },
  { id: 'rabbitmq', label: 'RabbitMQ', cat: 'messaging', npm: ['amqplib'], maven: ['spring-boot-starter-amqp', 'amqp-client'], pypi: ['pika', 'aio-pika'], images: ['rabbitmq'], q: ['rabbitmq'] },
  { id: 'sqs', label: 'AWS SQS/SNS', cat: 'messaging', npm: ['@aws-sdk/client-sqs'], q: ['aws sqs'] },
  { id: 'celery', label: 'Celery', cat: 'messaging', pypi: ['celery'], q: ['celery'] },
  { id: 'temporal', label: 'Temporal', cat: 'messaging', npm: ['@temporalio/*'], maven: ['io.temporal'], pypi: ['temporalio'], go: ['go.temporal.io/sdk'], q: ['temporal workflows'] },
  { id: 'elasticsearch', label: 'Elasticsearch / OpenSearch', cat: 'search', npm: ['@elastic/elasticsearch', '@opensearch-project/opensearch'], maven: ['elasticsearch', 'opensearch'], pypi: ['elasticsearch', 'opensearch-py'], images: ['elasticsearch', 'opensearch'], q: ['elasticsearch'] },

  // ---------- api styles ----------
  { id: 'graphql', label: 'GraphQL', cat: 'api', npm: ['graphql', '@apollo/server', '@apollo/client'], maven: ['graphql-java', 'spring-boot-starter-graphql'], pypi: ['strawberry-graphql', 'graphene'], q: ['graphql'] },
  { id: 'grpc', label: 'gRPC / Protobuf', cat: 'api', npm: ['@grpc/grpc-js'], maven: ['grpc-', 'protobuf-java'], pypi: ['grpcio'], go: ['google.golang.org/grpc'], cargo: ['tonic'], q: ['grpc protobuf'] },
  { id: 'trpc', label: 'tRPC', cat: 'api', npm: ['@trpc/server'], q: ['trpc'] },
  { id: 'openapi', label: 'OpenAPI', cat: 'api', maven: ['springdoc-openapi', 'swagger'], q: ['openapi'] },

  // ---------- testing ----------
  { id: 'jest', label: 'Jest', cat: 'testing', npm: ['jest'], q: ['jest testing'] },
  { id: 'vitest', label: 'Vitest', cat: 'testing', npm: ['vitest'], q: ['vitest'] },
  { id: 'playwright', label: 'Playwright', cat: 'testing', npm: ['@playwright/test', 'playwright'], pypi: ['playwright', 'pytest-playwright'], q: ['playwright'] },
  { id: 'cypress', label: 'Cypress', cat: 'testing', npm: ['cypress'], q: ['cypress'] },
  { id: 'testing-library', label: 'Testing Library', cat: 'testing', npm: ['@testing-library/*'], q: ['react testing library'] },
  { id: 'junit', label: 'JUnit', cat: 'testing', maven: ['junit', 'spring-boot-starter-test'], q: ['junit'] },
  { id: 'testcontainers', label: 'Testcontainers', cat: 'testing', maven: ['testcontainers'], npm: ['testcontainers'], pypi: ['testcontainers'], go: ['github.com/testcontainers'], q: ['testcontainers'] },
  { id: 'pytest', label: 'pytest', cat: 'testing', pypi: ['pytest'], q: ['pytest'] },
  { id: 'rspec', label: 'RSpec', cat: 'testing', gem: ['rspec'], q: ['rspec'] },

  // ---------- auth ----------
  { id: 'nextauth', label: 'Auth.js / NextAuth', cat: 'auth', npm: ['next-auth', '@auth/core'], q: ['nextauth authentication'] },
  { id: 'clerk', label: 'Clerk', cat: 'auth', npm: ['@clerk/*'], q: ['clerk'] },
  { id: 'better-auth', label: 'Better Auth', cat: 'auth', npm: ['better-auth'], q: ['better auth'] },
  { id: 'spring-security', label: 'Spring Security', cat: 'auth', maven: ['spring-boot-starter-security', 'spring-security'], q: ['spring security'] },
  { id: 'keycloak', label: 'Keycloak', cat: 'auth', maven: ['keycloak'], images: ['keycloak'], q: ['keycloak oauth'] },

  // ---------- ai / ml ----------
  { id: 'ai-sdk', label: 'Vercel AI SDK', cat: 'ai', npm: ['ai', '@ai-sdk/*'], q: ['ai sdk'] },
  { id: 'anthropic-sdk', label: 'Anthropic SDK', cat: 'ai', npm: ['@anthropic-ai/sdk'], pypi: ['anthropic'], q: ['claude api'] },
  { id: 'openai-sdk', label: 'OpenAI SDK', cat: 'ai', npm: ['openai'], pypi: ['openai'], q: ['openai api'] },
  { id: 'langchain', label: 'LangChain / LangGraph', cat: 'ai', npm: ['langchain', '@langchain/*'], pypi: ['langchain', 'langgraph'], q: ['langchain'] },
  { id: 'mcp', label: 'MCP', cat: 'ai', npm: ['@modelcontextprotocol/sdk'], pypi: ['mcp', 'fastmcp'], q: ['mcp server'] },
  { id: 'pytorch', label: 'PyTorch', cat: 'ai', pypi: ['torch'], q: ['pytorch'] },
  { id: 'tensorflow', label: 'TensorFlow', cat: 'ai', pypi: ['tensorflow'], q: ['tensorflow'] },
  { id: 'huggingface', label: 'Hugging Face', cat: 'ai', pypi: ['transformers'], q: ['hugging face transformers'] },
  { id: 'pandas', label: 'pandas / data science', cat: 'ai', pypi: ['pandas', 'polars', 'numpy', 'scikit-learn'], q: ['data analysis pandas'] },
  { id: 'jupyter', label: 'Jupyter', cat: 'ai', pypi: ['jupyter', 'ipykernel'], q: ['jupyter notebook'] },

  // ---------- infra / cloud / ci ----------
  { id: 'docker', label: 'Docker', cat: 'infra', q: ['docker'] },
  { id: 'docker-compose', label: 'Docker Compose', cat: 'infra', q: ['docker compose'] },
  { id: 'kubernetes', label: 'Kubernetes', cat: 'infra', q: ['kubernetes'] },
  { id: 'helm', label: 'Helm', cat: 'infra', q: ['helm charts'] },
  { id: 'terraform', label: 'Terraform', cat: 'infra', q: ['terraform'] },
  { id: 'pulumi', label: 'Pulumi', cat: 'infra', npm: ['@pulumi/pulumi'], q: ['pulumi'] },
  { id: 'aws-cdk', label: 'AWS CDK', cat: 'cloud', npm: ['aws-cdk-lib'], q: ['aws cdk'] },
  { id: 'aws', label: 'AWS', cat: 'cloud', npm: ['@aws-sdk/*', 'aws-sdk'], maven: ['software.amazon.awssdk', 'aws-java-sdk', 'spring-cloud-aws'], pypi: ['boto3'], go: ['github.com/aws/aws-sdk-go'], q: ['aws'] },
  { id: 'gcp', label: 'Google Cloud', cat: 'cloud', npm: ['@google-cloud/*'], maven: ['com.google.cloud'], pypi: ['google-cloud-'], q: ['google cloud'] },
  { id: 'azure', label: 'Azure', cat: 'cloud', npm: ['@azure/*'], maven: ['com.azure'], pypi: ['azure-'], nuget: ['azure.'], q: ['azure'] },
  { id: 'serverless', label: 'Serverless Framework', cat: 'cloud', npm: ['serverless'], q: ['serverless aws lambda'] },
  { id: 'vercel', label: 'Vercel', cat: 'cloud', npm: ['vercel', '@vercel/*'], q: ['vercel deployment'] },
  { id: 'cloudflare', label: 'Cloudflare Workers', cat: 'cloud', npm: ['wrangler', '@cloudflare/workers-types'], q: ['cloudflare workers'] },
  { id: 'github-actions', label: 'GitHub Actions', cat: 'ci', q: ['github actions'] },
  { id: 'gitlab-ci', label: 'GitLab CI', cat: 'ci', q: ['gitlab ci'] },
  { id: 'jenkins', label: 'Jenkins', cat: 'ci', q: ['jenkins pipeline'] },
  { id: 'circleci', label: 'CircleCI', cat: 'ci', q: ['circleci'] },
  { id: 'azure-pipelines', label: 'Azure Pipelines', cat: 'ci', q: ['azure devops pipelines'] },
  { id: 'opentelemetry', label: 'OpenTelemetry', cat: 'infra', npm: ['@opentelemetry/*'], maven: ['opentelemetry'], pypi: ['opentelemetry-'], go: ['go.opentelemetry.io'], q: ['opentelemetry observability'] },

  // ---------- monorepo tooling ----------
  { id: 'turborepo', label: 'Turborepo', cat: 'monorepo', npm: ['turbo'], q: ['turborepo'] },
  { id: 'nx', label: 'Nx', cat: 'monorepo', npm: ['nx'], q: ['nx monorepo'] },
  { id: 'pnpm-workspaces', label: 'pnpm workspaces', cat: 'monorepo', q: ['pnpm monorepo'] },
  { id: 'npm-workspaces', label: 'npm/yarn workspaces', cat: 'monorepo', q: ['monorepo'] },
  { id: 'lerna', label: 'Lerna', cat: 'monorepo', npm: ['lerna'], q: ['monorepo'] },
  { id: 'bazel', label: 'Bazel', cat: 'monorepo', q: ['bazel'] },
  { id: 'maven-multimodule', label: 'Maven multi-module', cat: 'monorepo', q: ['maven multi module'] },
  { id: 'gradle-multiproject', label: 'Gradle multi-project', cat: 'monorepo', q: ['gradle'] },
  { id: 'go-workspace', label: 'Go workspace', cat: 'monorepo', q: ['golang'] },
  { id: 'cargo-workspace', label: 'Cargo workspace', cat: 'monorepo', q: ['rust'] },
];

export const SIGNAL_BY_ID = Object.fromEntries(SIGNALS.map((s) => [s.id, s]));

// Lifecycle / quality queries that apply to any repo. "grill" covers the
// interview-style plan/design review skills.
export const LIFECYCLE_QUERIES = [
  { q: 'grill me', reason: 'interview-style review of plans and designs' },
  { q: 'code review', reason: 'reviewing changes before merge' },
  { q: 'tdd', reason: 'test-driven development workflow' },
  { q: 'systematic debugging', reason: 'structured debugging' },
  { q: 'git commit', reason: 'commit messages and git workflow' },
  { q: 'security review', reason: 'security checks' },
  { q: 'software architecture', reason: 'architecture and design decisions' },
  { q: 'refactoring', reason: 'safe refactoring' },
  { q: 'technical documentation', reason: 'docs and ADRs' },
];

// Which recommendation bucket each category falls into.
export const CATEGORY_BUCKET = {
  language: 'stack', framework: 'stack', frontend: 'stack', 'frontend-lib': 'stack', mobile: 'stack',
  styling: 'stack', build: 'stack', auth: 'stack', api: 'stack', ai: 'stack',
  orm: 'data', database: 'data', migrations: 'data', cache: 'data',
  messaging: 'data', search: 'data',
  testing: 'quality',
  infra: 'infra', cloud: 'infra', ci: 'infra', monorepo: 'infra',
  lifecycle: 'quality', domain: 'domain',
};

export const BUCKET_LABELS = {
  stack: 'Languages & frameworks',
  data: 'Database, data & messaging',
  infra: 'Infra, CI/CD & monorepo tooling',
  quality: 'Quality & lifecycle (testing, review, grilling, architecture)',
  domain: 'Business domain',
};

// Categories that define a "stack" for grouping monorepo projects.
export const CORE_CATS = new Set(['language', 'framework', 'frontend', 'mobile']);
