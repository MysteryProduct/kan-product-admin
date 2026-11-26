import axiosInstance from '@/lib/axios';
import { postProductionParams } from '@/lib/custom-post-production';
import type {
  PostProductionGroup,
  PostProductionList,
} from '@/types/custom-post-production';

class CustomPostProductionModel {
  // TASK-0212: one group of Custom requests after production - work that waits
  // oldest first, the shipped history newest first - with the counts of all
  // three groups for the same search.
  async list(
    group: PostProductionGroup,
    search: string,
    page = 1,
    limit = 20,
  ): Promise<PostProductionList> {
    const response = await axiosInstance.get<PostProductionList>(
      '/sale-order/custom/post-production',
      { params: postProductionParams(group, search, page, limit) },
    );
    return response.data;
  }
}

export default CustomPostProductionModel;
