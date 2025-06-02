// Supabase composable for contact submissions
// Updated to use the actual Supabase client

export function useSupabase() {
  const supabase = useSupabaseClient();

  const getContactSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching contact submissions:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('useSupabase: getContactSubmissions error:', error);
      return [];
    }
  };

  const createContactSubmission = async (submission: any) => {
    try {
      const { data, error } = await supabase
        .from('contact_submissions')
        .insert([submission])
        .select()
        .single();

      if (error) {
        console.error('Error creating contact submission:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('useSupabase: createContactSubmission error:', error);
      throw error;
    }
  };

  const updateContactSubmissionStatus = async (id: string, status: string) => {
    try {
      const { data, error } = await supabase
        .from('contact_submissions')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating contact submission:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('useSupabase: updateContactSubmissionStatus error:', error);
      throw error;
    }
  };

  const deleteContactSubmission = async (id: string) => {
    try {
      const { error } = await supabase.from('contact_submissions').delete().eq('id', id);

      if (error) {
        console.error('Error deleting contact submission:', error);
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('useSupabase: deleteContactSubmission error:', error);
      throw error;
    }
  };

  return {
    getContactSubmissions,
    createContactSubmission,
    updateContactSubmissionStatus,
    deleteContactSubmission,
  };
}
