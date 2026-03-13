[![Live App](https://img.shields.io/badge/Live%20App-Visit-green)](https://greenloop-project.vercel.app)

🌐 **Access the app here:** [website-greenloop.vercel.app](https://greenloop-project.vercel.app)

# GreenLoop - Employee Sustainability Platform

A comprehensive employee engagement platform designed to promote sustainability initiatives, track environmental impact, and build a greener workplace culture through gamification and team collaboration.

## 🌱 Overview

GreenLoop is a modern web application built with Next.js 14 that empowers organizations to engage their employees in sustainability initiatives. The platform combines gamification elements with comprehensive tracking and analytics to drive meaningful environmental change.

### Key Features

- **🌍 Sustainability Actions**: Comprehensive library of eco-friendly actions employees can take
- **🏆 Gamification**: Points, badges, levels, and challenges to motivate participation
- **👥 Team Collaboration**: Team-based challenges and leaderboards
- **📊 Analytics Dashboard**: Detailed insights into environmental impact and engagement
- **🔐 Enterprise Authentication**: Microsoft SSO integration and role-based access
- **⚙️ Admin Management**: Complete administrative control over platform settings
- **📱 Responsive Design**: Modern, mobile-first UI built with Tailwind CSS

## 🚀 Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide React** - Beautiful icon library
- **Recharts** - Data visualization

### Backend & Database
- **Supabase** - Backend-as-a-Service with PostgreSQL
- **Row Level Security (RLS)** - Database-level security
- **Real-time subscriptions** - Live updates

### Authentication & Security
- **Supabase Auth** - User authentication and management
- **Microsoft OAuth** - Enterprise SSO integration
- **PKCE Flow** - Secure OAuth implementation

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **pnpm** - Package management

## 📋 Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Supabase account and project
- Microsoft Azure App Registration (for SSO)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/greenloop_project.git
   cd greenloop_project
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # Site Configuration
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/dashboard
   
   # Microsoft OAuth (Optional)
   MICROSOFT_CLIENT_ID=your_microsoft_client_id
   MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
   MICROSOFT_TENANT_ID=your_microsoft_tenant_id
   ```

4. **Database Setup**
   - Import the database schema from `schema_dump.sql` into your Supabase project
   - Configure Row Level Security policies as needed

5. **Run the development server**
   ```bash
   pnpm dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Project Structure

```
greenloop_project/
├── app/                          # Next.js App Router pages
│   ├── admin/                   # Admin dashboard and management
│   ├── auth/                    # Authentication pages
│   ├── api/                     # API routes
│   ├── dashboard/               # User dashboard
│   ├── actions/                 # Sustainability actions
│   ├── challenges/              # Team challenges
│   ├── teams/                   # Team management
│   └── ...
├── components/                   # Reusable React components
│   ├── ui/                      # Base UI components
│   ├── admin/                   # Admin-specific components
│   └── charts/                  # Data visualization components
├── lib/                         # Utility libraries
│   ├── supabase/                # Supabase client configurations
│   └── validations/             # Form validation schemas
├── hooks/                       # Custom React hooks
└── public/                      # Static assets
```

## 🔧 Configuration

### Platform Settings

The platform can be customized through the admin settings panel:

- **Platform Name**: Customize the application name
- **Company Name**: Set your organization's name
- **Registration Control**: Enable/disable user registration
- **Team Settings**: Configure team creation and size limits
- **Challenge Settings**: Control challenge creation permissions

### Database Schema

Key database tables include:

- `users` - User profiles and authentication
- `sustainability_actions` - Available eco-friendly actions
- `user_actions` - User-submitted action completions
- `challenges` - Team-based sustainability challenges
- `teams` - Team management and membership
- `badges` - Achievement system
- `point_transactions` - Points tracking and history

## 🎯 Core Features

### For Employees

- **Action Library**: Browse and complete sustainability actions
- **Points & Badges**: Earn rewards for environmental contributions
- **Team Challenges**: Collaborate with colleagues on sustainability goals
- **Personal Dashboard**: Track progress and achievements
- **Leaderboards**: Compete with peers in friendly competition

### For Administrators

- **Analytics Dashboard**: Comprehensive insights into platform usage
- **Content Management**: Create and manage sustainability actions
- **User Management**: Oversee user accounts and permissions
- **Challenge Administration**: Set up team challenges and competitions
- **System Settings**: Configure platform-wide settings

### For Organizations

- **Environmental Impact Tracking**: Measure CO₂ reductions and sustainability metrics
- **Employee Engagement**: Boost morale through meaningful sustainability initiatives
- **Corporate Social Responsibility**: Demonstrate commitment to environmental goals
- **Community Building**: Foster team collaboration around shared values

## 🔐 Authentication

The platform supports multiple authentication methods:

1. **Email/Password**: Traditional authentication with email verification
2. **Microsoft SSO**: Enterprise single sign-on integration
3. **Invitation System**: Admin-controlled user onboarding

### Security Features

- Row Level Security (RLS) policies
- Role-based access control
- Secure password requirements
- Email verification for new accounts
- Admin-controlled registration

## 📊 Analytics & Reporting

The platform provides comprehensive analytics including:

- User engagement metrics
- Environmental impact calculations
- Team performance tracking
- Monthly trend analysis
- Category breakdown of actions
- Top performer identification

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms

The application can be deployed to any platform that supports Next.js:

- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the GitHub repository
- Check the documentation in the `/docs` folder
- Review the Supabase documentation for database-related questions

## 🌟 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Supabase](https://supabase.com/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Icons by [Lucide](https://lucide.dev/)

---

**GreenLoop** - Empowering organizations to build a sustainable future, one action at a time. 🌱
