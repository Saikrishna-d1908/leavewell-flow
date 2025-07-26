-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('employee', 'manager', 'admin');

-- Create leave status enum
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- Create leave type enum
CREATE TYPE public.leave_type AS ENUM ('sick', 'vacation', 'family_emergency', 'personal', 'other');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  manager_id UUID REFERENCES public.profiles(id),
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create leave_policies table
CREATE TABLE public.leave_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type leave_type NOT NULL,
  annual_quota INTEGER NOT NULL DEFAULT 20,
  max_consecutive_days INTEGER DEFAULT 30,
  requires_approval BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create leave_requests table
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  leave_type leave_type NOT NULL,
  custom_reason TEXT,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status leave_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create holidays table
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'employee')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'employee')
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leave_policies_updated_at
  BEFORE UPDATE ON public.leave_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Managers can view their team profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id OR 
    manager_id = auth.uid() OR 
    public.get_user_role(auth.uid()) IN ('admin', 'manager')
  );

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for leave_policies
CREATE POLICY "Everyone can view leave policies"
  ON public.leave_policies FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage leave policies"
  ON public.leave_policies FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for leave_requests
CREATE POLICY "Employees can view their own leave requests"
  ON public.leave_requests FOR SELECT
  USING (auth.uid() = employee_id);

CREATE POLICY "Employees can create their own leave requests"
  ON public.leave_requests FOR INSERT
  WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Employees can update their pending leave requests"
  ON public.leave_requests FOR UPDATE
  USING (auth.uid() = employee_id AND status = 'pending');

CREATE POLICY "Managers can view team leave requests"
  ON public.leave_requests FOR SELECT
  USING (
    auth.uid() = employee_id OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = employee_id AND p.manager_id = auth.uid()
    ) OR
    public.get_user_role(auth.uid()) IN ('admin', 'manager')
  );

CREATE POLICY "Managers can approve/reject leave requests"
  ON public.leave_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = employee_id AND p.manager_id = auth.uid()
    ) OR
    public.get_user_role(auth.uid()) IN ('admin', 'manager')
  );

-- RLS Policies for holidays
CREATE POLICY "Everyone can view holidays"
  ON public.holidays FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage holidays"
  ON public.holidays FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

-- Insert default leave policies
INSERT INTO public.leave_policies (leave_type, annual_quota, max_consecutive_days, requires_approval) VALUES
  ('sick', 10, 5, false),
  ('vacation', 20, 14, true),
  ('family_emergency', 5, 3, true),
  ('personal', 5, 2, true),
  ('other', 0, 1, true);

-- Insert some sample holidays
INSERT INTO public.holidays (name, date, description) VALUES
  ('New Year''s Day', '2024-01-01', 'New Year holiday'),
  ('Independence Day', '2024-07-04', 'Independence Day holiday'),
  ('Christmas Day', '2024-12-25', 'Christmas holiday');