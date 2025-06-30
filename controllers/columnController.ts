import { Op } from 'sequelize';
import db from '../models';

const { Column, ImagePath } = db;
import errorTypes from '../utils/errorTypes';
const { NotFoundError, BadRequestError, ForbiddenError } = errorTypes;
import { uploadToS3, parseAndReplaceImagesInHTML } from '../utils/imageHandler';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all Column items
 * @route GET /api/Column-items
 */
const getAllColumns = async (req: any, res: any, next: any) => {
  try {

    const { count, rows: ColumnItems } = await Column.findAndCountAll();

    res.status(200).json({
      success: true,
      count: count,
      data: ColumnItems,
    });
  } catch (error) {
    next(error);
  }
};

const getAllColumnsPagination = async (req: any, res: any, next: any) => {
  try {
    const {
      page = 1,
      limit = 200,
      searchTerm,
      category
    } = req.query;

    const offset = (page - 1) * limit;

    const whereCondition: any = {};
    if (category) {
      whereCondition['category'] = category;
    }
    if (searchTerm) {
      whereCondition[Op.or] = [
        { title: { [Op.like]: `%${searchTerm}%` } },
      ];
    }

    const { count, rows: ColumnItems } = await Column.findAndCountAll({
      where: whereCondition,
      limit: parseInt(limit, 10),
      offset: offset,
      include: [
        {
          model: ImagePath,
          as: 'thumbnail',
          required: false,
          where: { posting_category: 21 },
          attributes: ['entity_path'],
        },
      ],
    });

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      data: {
        ColumnItems,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Get Column item by ID
 * @route GET /api/Column-items/:id
 */
const getColumnItemById = async (req: any, res: any, next: any) => {
  console.log("AAAA")
  try {
    const { id } = req.params;

    const ColumnItem = await Column.findByPk(id, {
      include: [
        {
          model: ImagePath,
          as: 'thumbnail',
          required: false,
          where: { posting_category: 21 },
          attributes: ['entity_path'],
        },
      ],
    });

    if (!ColumnItem) {
      throw new NotFoundError('Column item not found');
    }

    res.status(200).json({
      success: true,
      data: ColumnItem
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Column item
 * @route POST /api/Column-items
 */
const createColumnItem = async (req: any, res: any, next: any) => {
  try {
    const { title, category } = req.body;
    let content = req.body.content || '';

    // Step 1: Handle thumbnail upload
    let thumbnailImageName = '';
    if (req.files?.['thumbnail']?.[0]) {
      const file = req.files['thumbnail'][0];
      const uploadResult = await uploadToS3(file);
      thumbnailImageName = uploadResult.key;

      await ImagePath.create({
        image_name: uploadResult.key,
        entity_path: uploadResult.url,
        posting_category: 21, // Thumbnail
        parent_id: 0, // Filled later after article is created
      });
    }

    // Step 2: Handle embedded TinyMCE images
    const { updatedHTML, uploadedImages } = await parseAndReplaceImagesInHTML(content);
    content = updatedHTML;

    // Step 3: Create article
    const column = await Column.create({
      title,
      category,
      // thumbnail_image: thumbnailImageName,
      content,
    });

    // Step 4: Update parent_id in image_paths
    if (thumbnailImageName) {
      await ImagePath.update({ parent_id: column.id }, { where: { image_name: thumbnailImageName } });
    }
    for (const img of uploadedImages) {
      await ImagePath.create({
        image_name: img.key,
        entity_path: img.url,
        posting_category: 22, // Content image
        parent_id: column.id,
      });
    }

    res.status(201).json({
      success: true,
      data: column,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update Column item
 * @route PUT /api/Column-items/:id
 */
const updateColumnItem = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { Column_id, display_flg } = req.body;

    const ColumnItem = await Column.findByPk(id);
    if (!ColumnItem) {
      throw new NotFoundError('Column item not found');
    }

    await ColumnItem.update({
      ...req.body
    });

    res.status(200).json({
      success: true,
      data: ColumnItem
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Column item
 * @route DELETE /api/Column-items/:id
 */
const deleteColumnItem = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    const ColumnItem = await Column.findByPk(id);
    if (!ColumnItem) {
      throw new NotFoundError('Column item not found');
    }
    await ColumnItem.destroy();

    res.status(200).json({
      success: true,
      message: 'Column item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAllColumns,
  getAllColumnsPagination,
  getColumnItemById,
  createColumnItem,
  updateColumnItem,
  deleteColumnItem
};