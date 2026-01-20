import axiosInstance from '@/lib/axios';

// Interface สำหรับ Product
export interface Product {
  id: string | number;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: 'Active' | 'Inactive' | 'Out of Stock';
  image?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Interface สำหรับ API Response
export interface ProductResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface SingleProductResponse {
  data: Product;
  message?: string;
}

// Interface สำหรับการสร้าง/แก้ไข Product
export interface CreateProductDto {
  name: string;
  category: string;
  price: number;
  stock: number;
  status?: 'Active' | 'Inactive' | 'Out of Stock';
  image?: string;
  description?: string;
}

export interface UpdateProductDto {
  name?: string;
  category?: string;
  price?: number;
  stock?: number;
  status?: 'Active' | 'Inactive' | 'Out of Stock';
  image?: string;
  description?: string;
}

// ===== Product API Service =====

/**
 * ดึงข้อมูล Products ทั้งหมด
 */
export const getProducts = async (
  page: number = 1,
  limit: number = 10,
  search?: string,
  category?: string
): Promise<ProductResponse> => {
  try {
    const response = await axiosInstance.get<ProductResponse>('/products', {
      params: {
        page,
        limit,
        ...(search && { search }),
        ...(category && { category }),
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

/**
 * ดึงข้อมูล Product ตาม ID
 */
export const getProductById = async (id: string | number): Promise<SingleProductResponse> => {
  try {
    const response = await axiosInstance.get<SingleProductResponse>(`/products/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    throw error;
  }
};

/**
 * สร้าง Product ใหม่
 */
export const createProduct = async (productData: CreateProductDto): Promise<SingleProductResponse> => {
  try {
    const response = await axiosInstance.post<SingleProductResponse>('/products', productData);
    return response.data;
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

/**
 * แก้ไข Product
 */
export const updateProduct = async (
  id: string | number,
  productData: UpdateProductDto
): Promise<SingleProductResponse> => {
  try {
    const response = await axiosInstance.put<SingleProductResponse>(`/products/${id}`, productData);
    return response.data;
  } catch (error) {
    console.error(`Error updating product ${id}:`, error);
    throw error;
  }
};

/**
 * ลบ Product
 */
export const deleteProduct = async (id: string | number): Promise<{ message: string }> => {
  try {
    const response = await axiosInstance.delete<{ message: string }>(`/products/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting product ${id}:`, error);
    throw error;
  }
};

/**
 * Toggle Product Status
 */
export const toggleProductStatus = async (id: string | number): Promise<SingleProductResponse> => {
  try {
    const response = await axiosInstance.patch<SingleProductResponse>(`/products/${id}/toggle-status`);
    return response.data;
  } catch (error) {
    console.error(`Error toggling product status ${id}:`, error);
    throw error;
  }
};

