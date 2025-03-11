// 获取工作项活动历史
export const getWorkItemActivities = async (workItemId) => {
  try {
    const response = await axios.get(`/api/work-items/${workItemId}/activities`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}; 