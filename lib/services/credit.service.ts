import { supabase } from '../core/config/supabase';

export class CreditService {
  static async addCredits(
    userId: string,
    amount: number,
    type: string,
    description: string,
  ): Promise<number> {
    // Try RPC first; fall back to manual read-modify-write
    const { data: rpcData, error: rpcErr } = await supabase.rpc('increment_credits', {
      p_user_id: userId,
      p_amount: amount,
    });
    let newBalance: number;
    if (rpcErr || rpcData === null) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();
      const current = (profileData as any)?.credits ?? 0;
      newBalance = current + amount;
      await supabase.from('profiles').update({ credits: newBalance }).eq('id', userId);
    } else {
      newBalance = rpcData as number;
    }

    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount,
      type,
      description,
    });

    return newBalance;
  }

  static async spendCredits(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('spend_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_description: description,
      p_reference_id: referenceId ?? null,
    });
    if (!error) return data as boolean;

    // Fallback: manual deduct
    const { data: profileData } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();
    const current = (profileData as any)?.credits ?? 0;
    if (current < amount) return false;

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ credits: current - amount })
      .eq('id', userId);
    if (updateErr) return false;

    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: -amount,
      type: 'spend',
      description,
      reference_id: referenceId ?? null,
    });
    return true;
  }

  static async getBalance(userId: string): Promise<number> {
    const { data } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();
    return (data as any)?.credits ?? 0;
  }
}
