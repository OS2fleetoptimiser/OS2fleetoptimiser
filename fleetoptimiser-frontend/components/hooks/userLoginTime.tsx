import { useQuery } from '@tanstack/react-query';
import AxiosBase from '../AxiosBase';

interface UserLogin {
  user_id: string;
  last_seen_date: string;
}

export function usePatchGetLoginTime(providerAccountId?: string) {
  return useQuery<UserLogin, unknown, string>(
    ['login time', providerAccountId],
    async () => {
      const res = await AxiosBase.patch<UserLogin>(`user/${providerAccountId}/login`);
      return res.data;
    },
    {
      select: (data) => data.last_seen_date,
      enabled: !!providerAccountId,
      refetchOnWindowFocus: false,
      staleTime: 600000,
    }
  );
};
