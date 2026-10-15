const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

bool get remoteReady =>
    supabaseUrl.isNotEmpty &&
    supabaseAnonKey.isNotEmpty &&
    !supabaseUrl.contains('YOUR_PROJECT_REF') &&
    !supabaseAnonKey.contains('YOUR_ANON_KEY');
