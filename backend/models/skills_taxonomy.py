"""Skills taxonomy: every skill SkillLens recognises, with its display name, category and spellings.

Each line in TAXONOMY is one skill:  Display name | other spelling | other spelling ...

    plain spelling    matched anywhere in the text, case-insensitive, whole words only,
                      with spaces, hyphens or nothing between words ("spring-boot", "springboot")
    =Spelling         matched only in exactly this case ("R", "Go", "SAP", "S3")
    ~spelling         accepted only as an item of a skills list ("Languages: C, C++"), never
                      from running text, because as a plain word it is ambiguous ("C", "pip", "Claude")
    key:xyz           the stable internal key; defaults to the lower-cased display name

A "~" or "=" in front of the display name applies to the display name itself.
Keys are what matching code compares (resume vs job posting vs JD), display names are what people see.
"""
import re
from dataclasses import dataclass
from functools import lru_cache

CATEGORIES = [
    'Programming languages', 'Backend', 'Frontend', 'Mobile', 'Databases', 'Cloud', 'DevOps & infrastructure',
    'Testing & QA', 'APIs & security', 'AI & machine learning', 'Data & analytics', 'Design',
    'Business software', 'Finance & accounting', 'Sales & marketing', 'Customer support & operations',
    'HR & people', 'Engineering & manufacturing', 'Practices & concepts', 'Soft skills', 'Spoken languages', 'Other',
]

TAXONOMY = {
    'Programming languages': """
        Python | python3 | python 3
        Java | core java | java se | j2se
        JavaScript | vanilla js | vanilla javascript | ecmascript | es6 | es2015 | =JS
        TypeScript
        ~C | ~c language | c programming
        C++ | cpp | c plus plus
        C# | c sharp | csharp
        =Go | =Golang | golang | key:go
        =R | r programming | r language | key:r
        =Rust
        =Ruby
        PHP
        =Swift
        Kotlin
        Scala
        Perl
        MATLAB
        =Julia
        =Dart
        Elixir
        Haskell
        =Lua
        Groovy
        Objective-C | objective c | objc
        SQL
        PL/SQL | plsql | pl sql
        T-SQL | tsql | transact sql
        Bash | bash scripting | bash script | bash scripts
        Shell scripting | shell script | shell scripts | unix shell scripting
        PowerShell
        VBA | =VBA | excel vba | vba macros
        COBOL
        Fortran
        Assembly language | assembly programming | ~assembly
        Solidity
        =Apex | salesforce apex
        ABAP | sap abap | key:sap abap
        Verilog
        VHDL
        Embedded C
        VB.NET | visual basic | visual basic .net
        WebAssembly | wasm
        Clojure
        F#
        Erlang
        =Zig
    """,
    'Backend': """
        =Spring | spring framework | key:spring
        Spring Boot | springboot | spring boot framework
        Spring MVC
        Spring Data JPA | spring data
        Spring Security
        Spring Cloud
        Spring Batch
        Spring WebFlux | webflux
        Hibernate | hibernate orm
        JPA | java persistence api
        Bean Validation | jakarta bean validation | hibernate validator | javax validation | jakarta validation
        J2EE | java ee | jakarta ee | jee
        Servlets | java servlets | servlet
        JSP | java server pages
        Struts | apache struts
        Micronaut
        Quarkus
        Node.js | nodejs | node js
        Express.js | expressjs | express js | =Express | key:express
        NestJS | nest.js | nest js
        Fastify
        =Koa | koa.js
        Django
        Django REST Framework | django rest | =DRF
        Flask
        FastAPI | fast api
        Pydantic
        Celery
        Laravel
        CodeIgniter
        Symfony
        Ruby on Rails | =Rails | key:ruby on rails
        ASP.NET | asp.net core | asp.net mvc | asp net
        .NET | dotnet | dot net | .net framework | key:.net
        .NET Core | dotnet core | .net 6 | .net 7 | .net 8
        ADO.NET
        Entity Framework | entity framework core | ef core
        =Gin | gin gonic
        Kafka | apache kafka | kafka streams
        RabbitMQ | rabbit mq
        ActiveMQ | apache activemq
        Apache Camel
        Socket.IO | socketio | socket io
        WebSockets | websocket | web sockets | web socket
        Nginx
        Apache Tomcat | tomcat
        WildFly | jboss
        Lombok
        MapStruct
        Liquibase
        Flyway
        Prisma | prisma orm
        Sequelize
        Mongoose
        TypeORM
        Drizzle ORM | drizzle
        SQLAlchemy | sql alchemy
        Alembic
        JDBC
        Microservices | microservice | microservices architecture | micro services
        Backend development | back end development | backend engineering | server side development
        Full stack development | full stack | fullstack | full-stack development
    """,
    'Frontend': """
        HTML | html5
        CSS | css3
        Sass | scss
        ~Less | less css
        Tailwind CSS | tailwind | tailwindcss
        Bootstrap
        Material UI | material-ui | mui
        Chakra UI
        shadcn/ui | shadcn
        jQuery
        =React | react.js | reactjs | react js | key:react
        Next.js | nextjs | next js
        Redux | redux toolkit
        Zustand
        React Query | tanstack query
        React Router
        =Angular | angularjs | angular js | angular.js | key:angular
        Vue.js | vue | vuejs | vue js | vue 3 | key:vue
        Nuxt.js | nuxt | nuxtjs
        Svelte | sveltekit
        =Vite
        Webpack
        Babel
        Gatsby
        Three.js | threejs
        Framer Motion
        GSAP
        Storybook
        Responsive design | responsive web design | responsive ui
        Web accessibility | accessibility | wcag | a11y
        Progressive web apps | progressive web app | =PWA | =PWAs
        WordPress
        Shopify
        Webflow
        Chart.js | chartjs
        AJAX
        Electron | electron.js
        Frontend development | front end development | front-end development | frontend engineering
        Web development | web developer
        HTMX
        Alpine.js
        Ember.js | emberjs
        Backbone.js
    """,
    'Mobile': """
        Android | android development | android sdk
        iOS | ios development
        React Native
        =Flutter
        Xamarin
        SwiftUI
        UIKit
        Jetpack Compose
        =Ionic | ionic framework
        ~Expo
        Mobile app development | mobile development | mobile applications | mobile apps
        Kotlin Multiplatform | kmm
    """,
    'Databases': """
        PostgreSQL | postgres | postgre sql | postgresql database
        MySQL
        SQLite
        =Oracle | oracle database | oracle db | key:oracle
        SQL Server | ms sql | mssql | microsoft sql server | ms sql server
        MariaDB
        MongoDB | mongo db | =Mongo
        Redis
        Cassandra | apache cassandra
        DynamoDB | amazon dynamodb | aws dynamodb | dynamo db
        Elasticsearch | elastic search
        OpenSearch | amazon opensearch
        Neo4j
        Couchbase
        CouchDB
        Firestore | cloud firestore
        Supabase
        PlanetScale
        =Neon | neon postgres | neon db
        ~H2 | h2 database | h2 db
        Memcached
        InfluxDB
        TimescaleDB
        ClickHouse
        CockroachDB
        Pinecone
        Weaviate
        ChromaDB | chroma db | ~chroma
        FAISS
        Milvus
        pgvector
        Qdrant
        Vector databases | vector database | vector db | vector store | vector stores
        NoSQL | =NoSQL
        Relational databases | rdbms | relational database | relational persistence | relational data persistence
        Database design | schema design | database schema design
        Stored procedures | stored procedure
        Query optimization | query optimisation | sql optimization | query tuning
        Database administration | dba | =DBA
    """,
    'Cloud': """
        AWS | amazon web services
        Microsoft Azure | azure | ms azure | key:azure
        Google Cloud | gcp | google cloud platform | key:gcp
        AWS Lambda | amazon lambda
        Amazon S3 | aws s3 | =S3
        Amazon EC2 | aws ec2 | =EC2
        AWS IAM | amazon iam | =IAM
        API Gateway | aws api gateway | amazon api gateway
        Amazon RDS | aws rds | =RDS
        Amazon Aurora | aws aurora
        Amazon SQS | aws sqs | =SQS
        Amazon SNS | aws sns | =SNS
        Amazon CloudWatch | cloudwatch | aws cloudwatch
        AWS CloudFormation | cloudformation
        AWS CDK | aws cloud development kit
        AWS Step Functions | step functions
        Amazon EventBridge | eventbridge | aws eventbridge
        Amazon ECS | aws ecs | =ECS
        Amazon EKS | aws eks | =EKS
        AWS Fargate | fargate
        Amazon VPC | aws vpc | =VPC
        Amazon Route 53 | route 53 | route53
        Amazon CloudFront | cloudfront
        AWS Glue | ~glue
        Amazon Athena | aws athena
        Amazon Kinesis | kinesis
        Amazon Connect | aws connect
        Amazon Lex | aws lex
        Amazon Polly | aws polly
        Amazon Transcribe | aws transcribe
        Amazon Comprehend | aws comprehend
        Amazon Rekognition | rekognition | aws rekognition
        Amazon Textract | textract
        Amazon Cognito | cognito | aws cognito
        AWS Amplify | amplify
        AWS Elastic Beanstalk | elastic beanstalk | beanstalk
        AWS Secrets Manager | secrets manager
        AWS Systems Manager | systems manager
        Amazon ElastiCache | elasticache
        Amazon EMR | aws emr
        Azure Functions
        Azure DevOps | azure devops services
        Azure Data Factory | =ADF
        Azure Blob Storage | blob storage
        Azure SQL Database | azure sql
        Azure Active Directory | azure ad | entra id | microsoft entra
        Azure Kubernetes Service | =AKS
        Azure App Service | app service
        Azure OpenAI | azure openai service
        Azure Synapse | synapse analytics | azure synapse analytics
        Google Cloud Functions | cloud functions
        Google Cloud Run | cloud run
        Google Kubernetes Engine | =GKE
        Google Cloud Storage
        Google Pub/Sub | pub/sub | pubsub
        Firebase | google firebase
        Vercel
        Netlify
        Heroku
        ~Render
        DigitalOcean | digital ocean
        Cloudflare | cloudflare workers
        Oracle Cloud | =OCI | oracle cloud infrastructure
        IBM Cloud
        ~Railway
        Serverless | serverless architecture | serverless computing | serverless framework
        Cloud computing | cloud technologies | cloud platforms | cloud native | cloud-native
        Cloud architecture | cloud architect | solution architecture | solutions architecture
        Multi-cloud | multicloud | hybrid cloud
    """,
    'DevOps & infrastructure': """
        Docker | docker compose | docker-compose
        Containerization | containerized | containerised | containerisation
        Kubernetes | k8s
        =Helm | helm charts
        Terraform
        Ansible
        =Puppet
        ~Chef | chef infra
        Jenkins
        GitHub Actions
        GitLab CI | gitlab ci/cd | gitlab ci cd | gitlab pipelines
        CircleCI
        Travis CI
        Bitbucket Pipelines
        Argo CD | argocd
        CI/CD | ci cd | cicd | ci/cd pipelines | ci/cd pipeline | ci cd pipeline | ci cd pipelines | cicd pipeline | continuous integration | continuous delivery | continuous deployment | key:ci/cd
        Git
        GitHub
        GitLab
        Bitbucket
        SVN | subversion
        =Maven | apache maven
        Gradle
        npm
        ~Yarn | yarn package manager
        pnpm
        ~pip
        ~Poetry
        Conda | anaconda
        Linux | linux administration
        Unix
        Ubuntu
        Red Hat | rhel | red hat enterprise linux
        Windows Server
        Prometheus
        Grafana
        ELK Stack | elk | elastic stack
        Kibana
        Logstash
        Splunk
        Datadog
        New Relic
        =Sentry
        Istio
        OpenShift
        Podman
        Vagrant
        ~Packer | hashicorp packer
        Infrastructure as Code | =IaC | infrastructure-as-code
        DevOps | dev ops
        Site reliability engineering | =SRE
        Observability
        ~Networking | computer networking | computer networks | network administration
        TCP/IP | tcp ip
        DNS
        Load balancing | load balancer | load balancers
        VMware | vsphere
        Active Directory
        Routing and switching | routing & switching | =CCNA
        Virtualization | virtualisation
        System administration | sysadmin | linux system administration
        Jira | atlassian jira
        Confluence
        =Postman
    """,
    'Testing & QA': """
        Unit testing | unit tests | unit test
        Integration testing | integration tests | integration test | api integration testing
        End-to-end testing | e2e testing | e2e tests | end to end testing | end-to-end tests | =E2E
        Test automation | automation testing | automated testing | automated tests | automation test
        Manual testing
        Regression testing
        Performance testing | load testing | stress testing
        API testing | api tests
        Software testing | qa testing
        Selenium | selenium webdriver
        Cypress
        Playwright
        Puppeteer
        =Jest
        Vitest
        =Mocha
        ~Chai
        JUnit | junit 5 | junit5 | junit 4 | junit4
        TestNG
        Mockito
        MockMvc
        Pytest | py.test
        React Testing Library | testing library
        Cucumber
        Behaviour-driven development | behavior driven development | behaviour driven development | =BDD
        Test-driven development | test driven development | =TDD
        JMeter | apache jmeter
        LoadRunner
        Appium
        Test case design | test cases | test case writing | test scenarios
        Quality assurance | =QA
        Bug tracking | defect tracking
    """,
    'APIs & security': """
        REST APIs | rest api | restful api | restful apis | rest apis | restful services | rest services | restful web services | =REST | =RESTful | key:rest api
        GraphQL
        gRPC
        =SOAP | soap api | soap web services
        Web services
        JSON
        XML
        OpenAPI | open api | openapi specification
        Swagger
        API design | api development
        Webhooks | webhook
        JWT | json web tokens | json web token
        OAuth | oauth 2.0 | oauth2 | oauth 2
        OpenID Connect | =OIDC
        Single sign-on | =SSO | single sign on
        RBAC | role-based access control | role based access control | role-based access | role based access
        bcrypt
        Encryption | cryptography
        Cybersecurity | cyber security | information security | infosec
        Network security
        Penetration testing | pen testing | pentesting
        Vulnerability assessment | =VAPT
        OWASP | owasp top 10
        =SIEM
        =SOC | security operations center | security operations
        Ethical hacking
        Burp Suite
        Wireshark
        Nmap
        Metasploit
        Kali Linux
        ISO 27001
        Payment gateway integration | payment gateway | payment gateways | payment integration | payment integrations
        Razorpay
        =Stripe
        PayPal
        Twilio
    """,
    'AI & machine learning': """
        Artificial intelligence | =AI | key:artificial intelligence
        Machine learning | =ML | ml engineering | ml models | machine learning models
        Deep learning | deep neural networks | =DNN
        Neural networks | neural network | artificial neural networks | =ANN
        Supervised learning
        Unsupervised learning
        Reinforcement learning
        NLP | natural language processing | key:nlp
        Computer vision | image processing
        Generative AI | genai | gen ai | generative artificial intelligence
        LLMs | llm | large language models | large language model | llm apis | llm api | key:llm
        Prompt engineering
        RAG | =RAG | retrieval augmented generation | retrieval-augmented generation
        AI agents | agentic ai | llm agents | ai agent
        Fine-tuning | fine tuning | finetuning | llm fine-tuning
        LangChain
        LlamaIndex
        LangGraph
        OpenAI API | openai | chatgpt api | gpt api
        ChatGPT
        =GPT | gpt-4 | gpt 4 | gpt-3.5
        ~Claude | anthropic claude | anthropic api | claude api
        Google Gemini | gemini api | ~gemini
        ~Llama | llama 2 | llama 3
        Amazon Bedrock | aws bedrock | =Bedrock
        Amazon Nova | aws nova
        Amazon SageMaker | sagemaker | aws sagemaker
        Vertex AI | google vertex ai
        Hugging Face | huggingface | hugging face spaces | hugging face hub | hugging face transformers
        ~Transformers | transformers library
        =BERT
        TensorFlow
        PyTorch
        Keras
        scikit-learn | sklearn | scikit learn
        XGBoost
        LightGBM
        CatBoost
        OpenCV | open cv
        =YOLO
        spaCy
        NLTK
        Gensim
        MLflow
        Kubeflow
        MLOps
        ONNX
        =CUDA
        Feature engineering
        Model deployment
        Transfer learning
        CNN | =CNNs | convolutional neural networks | convolutional neural network
        RNN | recurrent neural networks
        LSTM
        =GANs | =GAN | generative adversarial networks | generative adversarial network | key:gan
        Embeddings | vector embeddings | face embeddings | text embeddings | word embeddings
        Similarity search | cosine similarity | cosine-similarity | vector search | semantic search
        Face recognition | facial recognition | face detection | face enrollment
        ArcFace
        Object detection
        Image classification
        Text classification
        Sentiment analysis
        Speech recognition | speech to text
        Recommendation systems | recommender systems | recommendation engine | recommendation engines | recommender system
        Time series forecasting | time series analysis | time series
        Predictive modeling | predictive modelling | predictive analytics
        Conversational AI | chatbots | chatbot | voice bots | voicebot | conversational voice
        AutoML
        Anomaly detection | fraud detection
    """,
    'Data & analytics': """
        Data analysis | data analytics | analysing data | analyzing data
        ~Analytics
        Data science
        Data visualization | data visualisation | dataviz
        Data modeling | data modelling
        Data warehousing | data warehouse
        Data engineering
        ETL | =ETL | =ELT | extract transform load | etl pipelines | etl pipeline
        Data pipelines | data pipeline
        Data cleaning | data cleansing | data wrangling | data preprocessing
        Data governance
        Data quality
        Data integration
        Data migration
        Data management
        Data mining
        Big data
        Statistics | statistical analysis | statistical modeling | statistical modelling
        A/B testing | ab testing | a b testing | split testing
        =Excel | ms excel | microsoft excel | advanced excel | excel spreadsheets | key:excel
        VLOOKUP | xlookup
        Pivot tables | pivot table
        Google Sheets
        Power BI | powerbi | power-bi | microsoft power bi
        Tableau
        =Looker | looker studio | google data studio
        Qlik | qlikview | qlik sense
        Metabase
        Apache Superset | superset
        Pandas
        NumPy
        SciPy
        Matplotlib
        Seaborn
        Plotly
        Jupyter | jupyter notebook | jupyter notebooks
        Statsmodels
        =Polars
        Apache Spark | =Spark | spark sql | key:spark
        PySpark
        Hadoop | apache hadoop | hdfs
        =Hive | apache hive | hiveql
        Apache Airflow | airflow | key:airflow
        dbt | data build tool
        Databricks
        Snowflake
        BigQuery | google bigquery
        Amazon Redshift | redshift | aws redshift
        Informatica
        Talend
        SSIS
        SSRS
        SSAS
        Alteryx
        =SAS
        SPSS
        Google Analytics | =GA4
        Mixpanel
        ~Amplitude
        Hotjar
        Business intelligence | =BI | key:business intelligence
        ~Dashboards | dashboard development | dashboarding
        ~Reporting | ~reports
        D3.js | d3
        Web scraping | beautifulsoup | beautiful soup | scrapy
    """,
    'Design': """
        Figma
        Adobe XD
        =Sketch
        Adobe Photoshop | photoshop
        Adobe Illustrator | illustrator
        Adobe InDesign | indesign
        Adobe Premiere Pro | premiere pro
        Adobe After Effects | after effects
        Adobe Lightroom | lightroom
        CorelDRAW | corel draw
        Canva
        =Blender
        UI design | ui designing | user interface design
        UX design | ux | user experience | user experience design
        UI/UX | ui ux | ui/ux design | ui-ux
        User research
        Wireframing | wireframes | wireframe
        Prototyping | prototypes
        Graphic design | graphic designing
        Video editing
        Motion graphics
        Design systems | design system
        Interaction design
        Usability testing
        3D modeling | 3d modelling
        Visual design
        Product design
    """,
    'Business software': """
        =SAP | sap erp
        SAP FICO | sap fi co | sap fi/co | =FICO
        SAP FI | sap finance
        SAP CO | sap controlling
        SAP MM | sap materials management
        SAP SD | sap sales and distribution
        SAP PP
        SAP HCM
        SAP BASIS
        SAP HANA | sap s/4hana | s/4hana | sap s4 hana | sap s4hana | sap s hana | s4 hana
        SAP SuccessFactors | successfactors
        Salesforce | salesforce crm | =SFDC
        Visualforce
        Lightning Web Components | =LWC
        ServiceNow
        Workday
        Oracle E-Business Suite | oracle ebs
        Oracle Fusion
        Microsoft Dynamics 365 | dynamics 365 | dynamics crm | ms dynamics
        Zoho | zoho crm | zoho books
        HubSpot
        Zendesk
        Freshdesk | freshworks
        Trello
        Asana
        ~Notion
        ~Slack
        MS Office | microsoft office | ms-office | office 365 | microsoft 365
        Microsoft Word | ms word
        PowerPoint | ms powerpoint | microsoft powerpoint
        ~Outlook | ms outlook
        Google Workspace | g suite | gsuite
        SharePoint
        Power Apps | powerapps
        Power Automate | microsoft flow
        =Tally | tally erp | tally prime | tally erp 9 | key:tally
        =ERP | erp systems
        =CRM | crm software | customer relationship management | key:crm
        UiPath
        Automation Anywhere
        Blue Prism
        RPA | robotic process automation
        ~Automation
    """,
    'Finance & accounting': """
        ~Accounting | accountancy
        =GST | goods and services tax | gst filing | gst returns | key:gst
        =TDS | tds returns | key:tds
        Income tax | income tax returns | itr filing
        Taxation | direct tax | indirect tax
        Bank reconciliation | bank reconciliations | brs
        ~Reconciliation | account reconciliation | ledger reconciliation
        Accounts payable | accounts payables
        Accounts receivable
        General ledger
        Journal entries
        Balance sheet | balance sheets
        Financial reporting | financial statements
        Financial analysis
        Financial modeling | financial modelling
        Budgeting
        Forecasting | financial forecasting
        Variance analysis
        =MIS | mis reporting | mis reports | key:mis
        Auditing | internal audit | statutory audit | internal auditing
        Statutory compliance
        IFRS
        =Ind AS | key:ind as
        US GAAP | =GAAP
        Payroll | payroll processing | payroll management
        Invoice processing | invoicing
        Record to report | =R2R
        Procure to pay | =P2P
        Order to cash | =O2C
        Credit analysis | credit appraisal | credit risk
        Risk management
        Investment banking
        Equity research
        Portfolio management
        Valuation | company valuation | business valuation
        Treasury
        Banking operations
        =KYC
        Anti-money laundering | =AML | anti money laundering
        Financial planning
        Cost accounting
        Month-end closing | month end closing | month end close | month-end close
        Due diligence
        ~Billing
        ~Finance
        ~Banking
    """,
    'Sales & marketing': """
        ~Sales
        B2B sales | key:b2b sales
        B2C sales
        Business development
        Lead generation
        Cold calling
        Inside sales
        Field sales
        Channel sales
        Direct sales
        Corporate sales
        Retail sales
        Telesales | tele sales
        Telecalling | tele calling | tele-calling
        Key account management | key accounts
        Account management
        Client acquisition | customer acquisition | new client acquisition
        Client relationship management | client servicing
        Relationship management | relationship building
        Cross-selling | cross selling | cross sales
        Upselling | up selling | up-selling
        Negotiation | negotiation skills
        Presales | pre-sales | pre sales
        Sales strategy | sales planning
        Revenue generation
        Insurance sales
        Real estate sales
        =BFSI | bfsi sales
        Market research
        ~Marketing | sales and marketing
        Digital marketing
        SEO | search engine optimization | search engine optimisation
        =SEM | search engine marketing
        Social media marketing | =SMM | social media management
        Content marketing
        Content writing
        Copywriting
        Email marketing
        Performance marketing
        Google Ads | google adwords | adwords
        Meta Ads | facebook ads | facebook advertising | instagram ads
        Brand management | branding
        Affiliate marketing
        Marketing automation
        Influencer marketing
        Product marketing
        Growth marketing | growth hacking
        Marketing analytics
        Campaign management
    """,
    'Customer support & operations': """
        Customer service | customer care
        Customer support
        Technical support | tech support
        Voice process | international voice process | inbound voice process | outbound voice process | voice support
        Non-voice process | non voice process
        Chat support | chat process
        Email support
        =BPO | bpo voice | international bpo
        Call center | call centre | international call center
        =IVR | =IVRs | interactive voice response
        Customer experience | =CX
        Customer satisfaction | =CSAT
        Project management
        Program management
        Product management
        Operations management
        Stakeholder management
        Change management
        Process improvement | process optimization | process optimisation
        Continuous improvement
        Six Sigma | lean six sigma | six sigma green belt | six sigma black belt
        =Lean | lean management | key:lean
        Kaizen
        Root cause analysis | =RCA
        =PMP
        PRINCE2
        Business analysis | business analyst
        Requirements gathering | requirement gathering | requirements analysis
        Supply chain management | supply chain | =SCM
        Procurement
        Vendor management
        Inventory management | inventory control
        Logistics | logistics management
        Warehouse management | warehousing | =WMS
        ~Purchasing | purchase management
        Risk assessment
        Incident management
        =ITIL
        IT service management | =ITSM
        ~Documentation | technical documentation
        ~Consulting
        ~Operations
    """,
    'HR & people': """
        Recruitment | recruiting
        Talent acquisition
        End-to-end recruitment | end to end recruitment | full cycle recruitment | full-cycle recruiting
        IT recruitment | technical recruitment | tech recruitment
        ~Sourcing | candidate sourcing
        ~Onboarding | employee onboarding
        HR operations
        HR generalist | hr generalist activities
        Employee engagement
        Employee relations
        Performance management | performance appraisal
        =HRMS | =HRIS
        Training and development | learning and development | =L&D
        Compensation and benefits | comp and ben
        Joining formalities
        Exit formalities | exit interviews
        Human resource management | =HRM
        Labour laws | labor laws
    """,
    'Engineering & manufacturing': """
        AutoCAD | auto cad
        SolidWorks | solid works
        CATIA
        Revit
        STAAD Pro | staad.pro | staad
        ANSYS
        Creo | ptc creo
        Siemens NX | =NX
        =PLC | plc programming
        SCADA
        =HMI
        Embedded systems | embedded software
        Microcontrollers | microcontroller
        Arduino
        Raspberry Pi
        IoT | internet of things
        VLSI
        FPGA
        PCB design
        Simulink
        LabVIEW
        Quality control | =QC
        Production planning
        Preventive maintenance
        GD&T
        Lean manufacturing
        Primavera
        MS Project | microsoft project
        Robotics
        Control systems
        CNC programming | =CNC
    """,
    'Practices & concepts': """
        Agile | agile methodology | agile methodologies | agile development
        Scrum
        Kanban
        SDLC | software development life cycle | software development lifecycle
        System design
        Low-level design | =LLD | low level design
        High-level design | =HLD | high level design
        Event-driven architecture | event driven | event-driven | event driven architecture
        Distributed systems
        Object-oriented programming | object oriented programming | =OOP | =OOPs | =OOPS | object-oriented design
        Functional programming
        Data structures | data structures and algorithms | =DSA
        Algorithms
        Design patterns
        SOLID principles | =SOLID
        =MVC | model view controller
        Domain-driven design | =DDD | domain driven design
        =CRUD
        Code review | code reviews
        Version control
        Performance optimization | performance tuning | performance optimisation | performance improvements | performance improvement
        Debugging
        Troubleshooting | production troubleshooting | production support
        Multithreading | multi-threading | concurrency | concurrent programming
        Caching
        Message queues | message queue | message queuing
        Operating systems
        =DBMS | database management systems
        Clean architecture
        Scalability | scalable systems
        High availability
    """,
    'Soft skills': """
        Communication | communication skills | verbal communication | written communication | excellent communication
        Leadership | team leadership
        Team management | team handling
        Teamwork | team work | team player
        Collaboration
        Problem solving | problem-solving
        Critical thinking
        Analytical skills | analytical thinking | ~analytical
        Time management
        Adaptability
        Creativity
        Presentation skills
        Interpersonal skills
        Mentoring | mentorship
        Decision making | decision-making
        Attention to detail
        Public speaking
        Conflict resolution
        Emotional intelligence
        Multitasking | multi-tasking
    """,
    'Spoken languages': """
        ~English | fluent english | english fluency | ~english (fluent)
        ~Hindi
        ~Bengali | ~bangla
        ~Telugu
        ~Marathi
        ~Tamil
        ~Urdu
        ~Gujarati
        ~Kannada
        ~Odia | ~oriya
        ~Malayalam
        ~Punjabi
        ~Assamese
        ~Sanskrit
        ~French
        ~German
        ~Spanish
        ~Japanese
        ~Mandarin | ~chinese
        ~Arabic
        ~Russian
        ~Korean
        ~Italian
        ~Portuguese
    """,
}

# Extra checks for one-letter and everyday-word skills, given the text and the match position
def _guard_r(text, start, end):
    return text[end:end + 1] not in ("&", "'", ".", "-") and text[start - 1:start] not in ("&", ".")


def _guard_go(text, start, end):
    return text[end:end + 1] != '-' and not re.match(r'\s+(?:to|ahead|live|beyond|further|through|back)\b', text[end:end + 12])


GUARDS = {'r': _guard_r, 'go': _guard_go}


@dataclass(frozen=True)
class Skill:
    key: str
    name: str
    category: str


def norm(text):
    """Comparable form of a skill name: lower case, single spaces, no hyphens or trailing punctuation."""
    s = str(text).lower().replace('\u2019', "'")
    s = re.sub(r'[\s_\-]+', ' ', s).strip(' ,;:*\u2022\u00b7|')
    return s[:-1] if s.endswith('.') else s


def _case_form(text):
    """Like norm, but keeping the original letter case (for case-sensitive spellings)."""
    return re.sub(r'[\s_\-]+', ' ', str(text)).strip()


_VERSION_RE = re.compile(r'\s+v?\d+(?:\.\d+)*(?:\.x)?\+?$')
_PAREN_RE = re.compile(r'\s*\([^)]*\)\s*$')


def _build():
    skills, lookup, free_ci, free_cs = {}, {}, {}, {}
    for category, block in TAXONOMY.items():
        for line in block.strip().splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            tokens = [t.strip() for t in line.split('|') if t.strip()]
            raw_name, variants = tokens[0], tokens[1:]
            name = raw_name.lstrip('=~')
            key = None
            ci, cs, lookup_only = [], [], []
            (lookup_only if raw_name.startswith('~') else cs if raw_name.startswith('=') else ci).append(name)
            for v in variants:
                if v.startswith('key:'):
                    key = v[4:].strip()
                elif v.startswith('='):
                    cs.append(v[1:])
                elif v.startswith('~'):
                    lookup_only.append(v[1:])
                else:
                    ci.append(v)
            key = key or norm(name)
            if key in skills:
                raise ValueError(f'Duplicate skill key {key!r}')
            skills[key] = Skill(key, name, category)
            for spelling in [name, *ci, *cs, *lookup_only, key]:
                lookup.setdefault(norm(spelling), key)
            for v in ci:
                n = norm(v)
                free_ci.setdefault(n, key)
                if ' ' in n:
                    free_ci.setdefault(n.replace(' ', ''), key)  # "springboot", "nodejs"
            for v in cs:
                free_cs.setdefault(_case_form(v), key)
    return skills, lookup, free_ci, free_cs


SKILLS, _LOOKUP, _FREE_CI, _FREE_CS = _build()
# Single words that occur in some spelling; a token like "CI/CD" or "Node.js" is kept whole only if listed here
_VOCAB_TOKENS = {t for phrase in (*_FREE_CI, *_LOOKUP) for t in phrase.split()} | {
    t.lower() for phrase in _FREE_CS for t in phrase.split()}
_MAX_WORDS = max(len(p.split()) for p in (*_FREE_CI, *_FREE_CS))
_RAW_TOKEN_RE = re.compile(r"[A-Za-z0-9+#.&/'\u2019]+")
_GLUE_RE = re.compile(r'[ \t\r\n\-]*')


def _tokens(text):
    """Word tokens as (start, end, text). "CI/CD", "Node.js" and ".NET" stay whole; "OpenAPI/Swagger" splits."""
    out = []
    for m in _RAW_TOKEN_RE.finditer(text):
        start, word = m.start(), m.group()
        # Trim punctuation at the edges, keeping a leading dot only for names like ".NET"
        lead = 0
        while lead < len(word) and not (word[lead].isalnum() or (word[lead] == '.' and word[lead + 1:lead + 2].isalpha())):
            lead += 1
        word, start = word[lead:], start + lead
        word = re.sub(r"['\u2019]s$", '', word).rstrip(".&/'\u2019")
        if not word:
            continue
        if word.lower() in _VOCAB_TOKENS or not re.search(r'[/&.]', word[1:]):
            out.append((start, start + len(word), word))
            continue
        pos = 0
        for part in re.split(r'([/&.])', word):
            if part and part not in '/&.':
                out.append((start + pos, start + pos + len(part), part))
            pos += len(part)
    return out


def scan(text):
    """Known skills in running text as (start, end, key), reading left to right and taking the longest
    spelling at each point, so "Spring Boot" is one skill rather than "Spring" plus a stray "Boot"."""
    toks = _tokens(text)
    n = len(toks)
    # A phrase may only continue across spaces, line breaks or hyphens, never across commas or brackets
    joins = [i + 1 < n and _GLUE_RE.fullmatch(text[toks[i][1]:toks[i + 1][0]]) is not None for i in range(n)]
    lowers = [t[2].lower() for t in toks]
    found, i = [], 0
    while i < n:
        hit = None
        span = 1
        while span < _MAX_WORDS and i + span - 1 < n - 1 and joins[i + span - 1]:
            span += 1
        for size in range(span, 0, -1):
            words = toks[i:i + size]
            key = _FREE_CS.get(' '.join(t[2] for t in words)) or _FREE_CI.get(' '.join(lowers[i:i + size]))
            if key and (key not in GUARDS or GUARDS[key](text, words[0][0], words[-1][1])):
                hit = (words[0][0], words[-1][1], key, size)
                break
        if hit:
            found.append(hit[:3])
            i += hit[3]
        else:
            i += 1
    return found


@lru_cache(maxsize=65536)
def key_for(text):
    """Key of a known skill written in any of its spellings, or None."""
    s = norm(text)
    if not s:
        return None
    if s in _LOOKUP:
        return _LOOKUP[s]
    for variant in (_PAREN_RE.sub('', s), _VERSION_RE.sub('', s), _VERSION_RE.sub('', _PAREN_RE.sub('', s))):
        if variant and variant != s and variant in _LOOKUP:
            return _LOOKUP[variant]
    return None


def skill_key(text):
    """Stable comparison key for any skill string, known or not."""
    return key_for(text) or norm(text)


def display_name(text, fallback='keep'):
    """How a skill should be shown. Unknown skills are kept as written, or sentence-cased."""
    key = key_for(text)
    if key:
        return SKILLS[key].name
    text = str(text).strip()
    if fallback == 'sentence' and text.islower():
        return text[:1].upper() + text[1:]
    return text


def category_of(text):
    key = key_for(text)
    return SKILLS[key].category if key else None
