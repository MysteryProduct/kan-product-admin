import axiosInstance from '@/lib/axios';
import { Product, ProductResponse, CreateProductDto, UpdateProductDto } from '@/types/product';
import { PaginationMeta } from '@/types/pagination';

// Interface สำหรับ API Response
export interface ApiProductResponse {
  data: Product[];
  meta: PaginationMeta;
}

export interface SingleProductResponse {
  data: Product;
  message?: string;
}

// ===== Product API Service =====

class ProductModel {
  /**
   * ดึงข้อมูล Products ทั้งหมด
   */
  async getProducts(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<ApiProductResponse> {
    try {
      const response = await axiosInstance.get<ApiProductResponse>('/products', {
        params: {
          page,
          limit,
          ...(search && { search }),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  /**
   * ดึงข้อมูล Product ตาม ID
   */
  async getProductById(id: number): Promise<Product> {
    try {
      const response = await axiosInstance.get<SingleProductResponse>(`/products/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching product ${id}:`, error);
      throw error;
    }
  }

  /**
   * สร้าง Product ใหม่พร้อมไฟล์
   */
  async createProduct(productData: CreateProductDto): Promise<Product> {
    try {
      const formData = new FormData();
      formData.append('product_name', productData.product_name);
      formData.append('product_description', productData.product_description);
      formData.append('price', productData.price.toString());
      formData.append('category_id', productData.category_id.toString());
      formData.append('color_id', productData.color_id.toString());

      // เพิ่มไฟล์
      if (productData.files) {
        productData.files.forEach((file) => {
          formData.append('files', file);
        });
      }

      const response = await axiosInstance.post<SingleProductResponse>('/product', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  /**
   * แก้ไข Product
   */
  async updateProduct(productData: UpdateProductDto): Promise<Product> {
    try {
      const formData = new FormData();
      formData.append('product_name', productData.product_name);
      formData.append('product_description', productData.product_description);
      formData.append('price', productData.price.toString());
      formData.append('category_id', productData.category_id.toString());
      formData.append('color_id', productData.color_id.toString());

      // เพิ่มไฟล์ใหม่
      if (productData.files) {
        productData.files.forEach((file) => {
          formData.append('files', file);
        });
      }

      // เพิ่ม IDs ของไฟล์เดิมที่ต้องการเก็บไว้
      if (productData.existing_files) {
        formData.append('existing_files', JSON.stringify(productData.existing_files));
      }

      const response = await axiosInstance.put<SingleProductResponse>(
        `/products/${productData.product_id}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data.data;
    } catch (error) {
      console.error(`Error updating product ${productData.product_id}:`, error);
      throw error;
    }
  }

  /**
   * ลบ Product
   */
  async deleteProduct(id: number): Promise<void> {
    try {
      await axiosInstance.delete(`/products/${id}`);
    } catch (error) {
      console.error(`Error deleting product ${id}:`, error);
      throw error;
    }
  }
}

export default ProductModel;

