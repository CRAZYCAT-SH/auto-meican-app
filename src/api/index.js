import axios from 'axios'

// 创建axios实例
const apiClient = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL || 'http://117.72.126.49/backend/api',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    // config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器
apiClient.interceptors.response.use(
  response => {
    if (response.data.code === 200) {
      return response.data.data  // 只返回data部分
    } else {
      return Promise.reject(new Error(response.data.msg || '请求失败'))
    }
  },
  error => {
    if (error.response?.status === 401) {
      // 处理未授权情况
      localStorage.removeItem('token')
      localStorage.removeItem('isLoggedIn')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default {
  // 登录接口
  login(credentials) {
    return {'token':credentials.username}
  },

  // 获取首页数据（带餐厅信息）
  async getHomeData() {
    // 获取当前工号
    const accountName = localStorage.getItem('token')
    
    // 获取当前时区的日期，格式为yyyy-MM-dd
    const formatDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    const currentDate = formatDate(new Date())
    
    // 使用新接口获取带餐厅信息的菜品数据
    try {
      // 首先尝试获取当天的数据
      const response = await apiClient.get('/meicanTask/restaurantDishList', {
        params: {
          accountName,
          date: currentDate
        }
      })
      
      // 如果当天有数据，直接返回
      if (response && response.length > 0) {
        return response
      }
      
      // 如果当天没有数据，尝试获取明天的数据
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowDate = formatDate(tomorrow)
      
      return apiClient.get('/meicanTask/restaurantDishList', {
        params: {
          accountName,
          date: tomorrowDate
        }
      })
    } catch (error) {
      console.error('获取菜单数据失败:', error)
      throw error
    }
  },

  // 获取餐厅菜品列表（新增专用接口）
  async getRestaurantDishList(accountName, date) {
    try {
      return apiClient.get('/meicanTask/restaurantDishList', {
        params: {
          accountName,
          date
        }
      })
    } catch (error) {
      console.error('获取餐厅菜品列表失败:', error)
      throw error
    }
  },

  // 新增获取用户列表接口
  getUserList() {
    return apiClient.get('/meicanAccount/listAll')
  },

  async getOrderHistory(accountName = true) {
    try {
      let url = '/meicanTask/pageTask?pageNo=1&pageSize=100';
      
      // 如果accountName为true，则添加当前登录token作为参数
      if (accountName) {
        const token = localStorage.getItem('token');
        url += `&accountName=${token}`;
      }
      
      const response = await apiClient.get(url);
      return response.records.map(item => ({
        orderId: item.uid,
        item: {
          name: item.orderDish,
          uid: item.accountName
        },
        dates: [item.orderDate],
        status: item.orderStatus,
        createTime: item.createDate,
        errorMsg: item.errorMsg,
        selectReason: item.selectReason || '' // 新增推荐理由字段
      }));
    } catch (error) {
      console.error('获取订单历史失败:', error);
      throw error;
    }
  },

  async deleteOrder(orderId) {
    return apiClient.delete(`/meicanTask/removeTask?taskId=${orderId}`)
  },

  async submitOrder(order) {
    const token = localStorage.getItem('token')
    const requestData = {
      accountName: token,
      orderDish: order.orderDish,
      orderDate: order.orderDate
    }
    
    // 如果有推荐理由,则添加到请求中
    if (order.selectReason) {
      requestData.selectReason = order.selectReason
    }
    
    return apiClient.post('/meicanTask/addTask', requestData)
  },

  async addAccount(accountInfo) {
      return apiClient.post('/meicanAccount/addAccount', {
        accountName: accountInfo.username,
        accountPassword: accountInfo.password,
        accountCookie: accountInfo.cookie
      })
  },

  async getBlacklist() {
    try {
      const token = localStorage.getItem('token')
      const response = await apiClient.get('/meicanAccount/listAllCheck')
      
      // 查找当前用户的拉黑记录
      const userBlacklist = response.find(item => item.accountName === token)
      
      // 检查是否存在且未过期
      if (userBlacklist && userBlacklist.noOrderDishes) {
        const currentDate = new Date()
        const expireDate = new Date(userBlacklist.expireDate)
        
        // 如果未过期，返回拉黑菜品
        if (expireDate > currentDate) {
          return userBlacklist.noOrderDishes.split(',').map(dish => dish.trim())
        }
        
        // 如果已过期，返回空数组
        return []
      }
      
      // 如果没有找到或没有拉黑菜品，返回空数组
      return []
    } catch (error) {
      console.error('获取拉黑列表失败:', error)
      throw error
    }
  },

  async addToBlacklist(blacklist, newItem) {
    try {
      const token = localStorage.getItem('token')
      
      // 1. 获取当前用户的拉黑记录
      const { expireDate } = await this.getBlacklistDetail()
      
      // 2. 更新黑名单
      const updatedBlacklist = [...blacklist, newItem].join(',')
      
      // 获取当前的likes和restrictions
      const currentInfo = await this.getAutoOrderInfo()
      
      return apiClient.post('/meicanAccount/addAccountDishCheck', {
        accountName: token,
        expireDate: expireDate,
        noOrderDishes: updatedBlacklist,
        likes: currentInfo.likes || '',
        restrictions: currentInfo.restrictions || ''
      })
    } catch (error) {
      console.error('添加黑名单失败:', error)
      throw error
    }
  },

  async removeFromBlacklist(blacklist, itemToRemove) {
    try {
      const token = localStorage.getItem('token')
      
      // 1. 获取当前用户的拉黑记录
      const { expireDate } = await this.getBlacklistDetail()
      
      // 2. 更新黑名单
      const updatedBlacklist = blacklist
        .filter(item => item !== itemToRemove)
        .join(',')
      
      // 获取当前的likes和restrictions
      const currentInfo = await this.getAutoOrderInfo()
        
      return apiClient.post('/meicanAccount/addAccountDishCheck', {
        accountName: token,
        expireDate: expireDate,
        noOrderDishes: updatedBlacklist,
        likes: currentInfo.likes || '',
        restrictions: currentInfo.restrictions || ''
      })
    } catch (error) {
      console.error('移除黑名单失败:', error)
      throw error
    }
  },

  // 修改为对象方法定义方式
  async getBlacklistDetail() {
    try {
      const token = localStorage.getItem('token')
      const response = await apiClient.get('/meicanAccount/listAllCheck')
      
      // 查找当前用户的记录
      const userRecord = response.find(item => item.accountName === token)
      
      // 如果没有找到记录
      if (!userRecord) {
        throw new Error('未找到用户的AI点餐记录，请在点餐检查维护AI点餐设置')
      }
      
      // 检查有效期
      const currentDate = new Date()
      const expireDate = new Date(userRecord.expireDate)
      
      // 如果记录已过期
      if (expireDate < currentDate) {
        throw new Error('AI点餐记录已过期，请在点餐检查维护AI点餐设置')
      }
      
      return {
        noOrderDishes: userRecord.noOrderDishes.split(',').map(dish => dish.trim()),
        expireDate: userRecord.expireDate
      }
    } catch (error) {
      console.error('获取AI点餐详情失败:', error)
      throw error
    }
  },
  async getAutoOrderInfo() {
    try {
      const token = localStorage.getItem('token')
      const response = await apiClient.get('/meicanAccount/listAllCheck')
      
      // 查找当前用户的记录
      const userRecord = response.find(item => item.accountName === token)
      
      // 如果没有找到记录，返回空数据
      if (!userRecord) {
        return {
          noOrderDishes: [],
          expireDate: null
        }
      }
      
      // 直接返回数据,不做验证
      return {
        noOrderDishes: userRecord.noOrderDishes?.split(',').map(dish => dish.trim()) || [],
        expireDate: userRecord.expireDate,
        likes: userRecord.likes || '',
        restrictions: userRecord.restrictions || ''
      }
    } catch (error) {
      console.error('获取AI点餐详情失败:', error)
      throw error
    }
  },
  async updateExpireDate(newExpireDate) {
    try {
      const token = localStorage.getItem('token')
      const currentData = await this.getAutoOrderInfo()
      
      // 格式化日期为YYYY-MM-DD
      const formattedDate = new Date(newExpireDate).toISOString().split('T')[0]
      
      const response = await apiClient.post('/meicanAccount/addAccountDishCheck', {
        accountName: token,
        expireDate: formattedDate,
        noOrderDishes: currentData.noOrderDishes.join(','),
        likes: currentData.likes || '',
        restrictions: currentData.restrictions || ''
      })
      
      return response.data
    } catch (error) {
      console.error('更新有效期失败:', error)
      throw new Error('更新有效期失败，请稍后重试')
    }
  },
  async updatePreferences(likes, restrictions) {
    try {
      const token = localStorage.getItem('token')
      const currentData = await this.getAutoOrderInfo()
      
      const response = await apiClient.post('/meicanAccount/addAccountDishCheck', {
        accountName: token,
        expireDate: currentData.expireDate,
        noOrderDishes: currentData.noOrderDishes.join(','),
        likes: likes || '',
        restrictions: restrictions || ''
      })
      
      return response.data
    } catch (error) {
      console.error('更新偏好设置失败:', error)
      throw new Error('更新偏好设置失败，请稍后重试')
    }
  },
  async submitAllChanges(data) {
    try {
      const response = await apiClient.post('/meicanAccount/addAccountDishCheck', {
        accountName: data.accountName,
        expireDate: data.expireDate,
        noOrderDishes: data.noOrderDishes,
        likes: data.likes || '',
        restrictions: data.restrictions || ''
      })
      
      return response.data
    } catch (error) {
      console.error('保存失败:', error)
      throw new Error('保存失败，请稍后重试')
    }
  },
  async recommendDish(accountName, orderDate, recentRecommend = '') {
    try {
      const response = await apiClient.get('/meicanTask/recommendDish', {
        params: {
          accountName,
          orderDate,
          recentRecommend
        },
        timeout: 30000 // 设置30秒超时时间
      })
      return response
    } catch (error) {
      console.error('获取推荐菜品失败:', error)
      throw new Error('获取推荐菜品失败,请稍后重试')
    }
  }
}