import axiosInstance from '@/lib/axios';
import { Product, CreateProductDto, UpdateProductDto } from '@/types/product';
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
    search?: string,
    sortField?: 'adddate' | 'product_variant_price' | null,
    sortOrder?: 'ASC' | 'DESC',
    filters?: Record<string, string>,
  ): Promise<ApiProductResponse> {
    try {
      const response = await axiosInstance.get<ApiProductResponse>('/product', {
        params: {
          page,
          limit,
          ...(search && { search }),
          ...(sortField && { sortField }),
          ...(sortOrder && { sortOrder }),
          ...(filters && { filters: JSON.stringify(filters) }),
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
  async getProductById(id: string): Promise<Product> {
    try {
      const response = await axiosInstance.get<SingleProductResponse>(`/product/${id}`);
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
      formData.append('category_id', productData.category_id.toString());
      formData.append('product_variants', JSON.stringify(productData.product_variants));

      const primaryVariant = productData.product_variants[0];
      if (primaryVariant) {
        // Compatibility with legacy backend fields.
        formData.append('product_variant_price', primaryVariant.product_variant_price.toString());
        formData.append('color_id', primaryVariant.color_id.toString());
        formData.append('product_unit_id', primaryVariant.product_unit_id.toString());
        formData.append('product_materials', JSON.stringify(primaryVariant.product_materials));
      }

      if (productData.product_files) {
        productData.product_files.forEach((file) => {
          formData.append('product_files', file);
          formData.append('files', file);
        });
      }

      if (productData.variant_files) {
        Object.entries(productData.variant_files).forEach(([variantKey, files]) => {
          files.forEach((file) => {
            formData.append(`variant_files[${variantKey}]`, file);
          });
        });
      }

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
      formData.append('category_id', productData.category_id.toString());
      formData.append('product_variants', JSON.stringify(productData.product_variants));

      const primaryVariant = productData.product_variants[0];
      if (primaryVariant) {
        // Compatibility with legacy backend fields.
        formData.append('product_variant_price', primaryVariant.product_variant_price.toString());
        formData.append('color_id', primaryVariant.color_id.toString());
        formData.append('product_unit_id', primaryVariant.product_unit_id.toString());
        formData.append('product_materials', JSON.stringify(primaryVariant.product_materials));
      }

      if (productData.product_files) {
        productData.product_files.forEach((file) => {
          formData.append('product_files', file);
          formData.append('files', file);
        });
      }

      if (productData.variant_files) {
        Object.entries(productData.variant_files).forEach(([variantKey, files]) => {
          files.forEach((file) => {
            formData.append(`variant_files[${variantKey}]`, file);
          });
        });
      }

      if (productData.existing_product_files) {
        formData.append('existing_product_files', JSON.stringify(productData.existing_product_files));
      }

      if (productData.existing_variant_files) {
        formData.append('existing_variant_files', JSON.stringify(productData.existing_variant_files));
      }

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

      const response = await axiosInstance.patch<SingleProductResponse>(
        `/product/${productData.product_id}`,
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
  async deleteProduct(id: string): Promise<void> {
    try {
      await axiosInstance.delete(`/product/${id}`);
    } catch (error) {
      console.error(`Error deleting product ${id}:`, error);
      throw error;
    }
  }
}

export default ProductModel;

