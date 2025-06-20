import type { ProjectTemplate } from '~/types/project';

export const mockTemplates: ProjectTemplate[] = [
  {
    id: 'image-classifier',
    name: 'Image Classifier',
    description: 'Build an image classification model using CNNs.',
    category: 'Computer Vision',
    icon: 'mdi-camera',
    features: ['Transfer Learning', 'Data Augmentation'],
    technologies: ['TensorFlow', 'Keras', 'OpenCV'],
    techStack: ['TensorFlow', 'Keras', 'OpenCV'],
    difficulty: 'Beginner',
    estimatedTime: '15 minutes',
    includes: ['Sample dataset loader', 'CNN architecture', 'Training loop', 'Evaluation script'],
    config: {
      type: 'cv',
      algorithm: 'cnn',
      pipeline: {
        nodes: [
          { id: 'data-input', type: 'data_input', label: 'Image Data' },
          { id: 'preprocess', type: 'preprocessing', label: 'Resize & Normalize' },
          { id: 'model', type: 'model', label: 'CNN Model' },
          { id: 'train', type: 'training', label: 'Train Model' },
          { id: 'eval', type: 'evaluation', label: 'Evaluate' },
        ],
      },
    },
  },
  {
    id: 'sentiment-analysis',
    name: 'Sentiment Analysis',
    description: 'Classify text sentiment using transformer models.',
    category: 'Natural Language',
    icon: 'mdi-message-text',
    features: ['BERT', 'Multi-class Classification'],
    technologies: ['PyTorch', 'Transformers', 'NLTK'],
    techStack: ['PyTorch', 'Transformers', 'NLTK'],
    difficulty: 'Intermediate',
    estimatedTime: '25 minutes',
    includes: ['BERT fine-tuning script', 'Text tokenizer', 'Training & validation loops'],
    config: {
      type: 'nlp',
      algorithm: 'bert',
      pipeline: {
        nodes: [
          { id: 'text-input', type: 'data_input', label: 'Text Input' },
          { id: 'tokenize', type: 'preprocessing', label: 'Tokenize' },
          { id: 'bert', type: 'model', label: 'BERT Model' },
          { id: 'train', type: 'training', label: 'Fine-tune' },
          { id: 'predict', type: 'output', label: 'Predictions' },
        ],
      },
    },
  },
  {
    id: 'sales-forecasting',
    name: 'Sales Forecasting',
    description: 'Forecast sales using ARIMA on time series data.',
    category: 'Time Series',
    icon: 'mdi-chart-line',
    features: ['ARIMA', 'Trend Decomposition'],
    technologies: ['Statsmodels', 'Pandas'],
    techStack: ['Statsmodels', 'Pandas'],
    difficulty: 'Intermediate',
    estimatedTime: '30 minutes',
    includes: ['ARIMA config', 'Forecast script', 'Visualization'],
    config: {
      type: 'time-series',
      algorithm: 'arima',
      pipeline: {
        nodes: [
          { id: 'sales-data', type: 'data_input', label: 'Sales Data' },
          { id: 'decompose', type: 'preprocessing', label: 'Decompose Series' },
          { id: 'arima', type: 'model', label: 'ARIMA Model' },
          { id: 'predict', type: 'prediction', label: 'Forecast' },
        ],
      },
    },
  },
{
  id: 'image-classifier',
    name: 'Image Classifier',
    category: 'Computer Vision',
    description: 'Train a CNN model to classify images into categories.',
    icon: 'mdi-camera',
    features: ['Transfer Learning', 'Data Augmentation'],
    techStack: ['TensorFlow', 'Keras'],
    difficulty: 'Beginner',
    estimatedTime: '15 minutes',
    includes: [
      'Image data loader',
      'CNN architecture (MobileNetV2)',
      'Training/validation split',
      'Accuracy/loss monitoring'
    ],
    config: {
      type: 'cv',
      framework: 'tensorflow',
      nodes: [
        { type: 'data-loader', config: { format: 'images' }},
        { type: 'preprocessing', config: { resize: [224, 224], normalize: true }},
        { type: 'model', config: { architecture: 'mobilenet_v2' }},
        { type: 'training', config: { epochs: 10, batch_size: 32 }}
      ]
    }
  },
  {
    id: 'text-classification',
    name: 'Text Classification',
    category: 'Natural Language',
    description: 'Classify text documents using a transformer-based model.',
    icon: 'mdi-text',
    features: ['BERT', 'Multi-class Classification'],
    techStack: ['PyTorch', 'Transformers'],
    difficulty: 'Intermediate',
    estimatedTime: '25 minutes',
    includes: [
      'Tokenizer (BERT)',
      'Transformer encoder',
      'Softmax output head',
      'Validation set scoring'
    ],
    config: {
      type: 'nlp',
      framework: 'pytorch',
      nodes: [
        { type: 'data-loader', config: { format: 'text' }},
        { type: 'tokenizer', config: { model: 'bert-base-uncased' }},
        { type: 'model', config: { architecture: 'bert' }},
        { type: 'training', config: { epochs: 3, learning_rate: 2e-5 }}
      ]
    }
  },
  {
    id: 'regression-analysis',
    name: 'Regression Analysis',
    category: 'Predictive Modeling',
    description: 'Build a regression model for continuous target prediction.',
    icon: 'mdi-chart-line',
    features: ['Feature Scaling', 'XGBoost'],
    techStack: ['scikit-learn', 'XGBoost'],
    difficulty: 'Intermediate',
    estimatedTime: '20 minutes',
    includes: [
      'Tabular data loader',
      'Feature normalization',
      'XGBoost regressor',
      'MSE & R2 metrics'
    ],
    config: {
      type: 'regression',
      framework: 'sklearn',
      nodes: [
        { type: 'data-loader', config: { format: 'tabular' }},
        { type: 'feature-engineering', config: { scaling: 'standard' }},
        { type: 'model', config: { algorithm: 'xgboost' }},
        { type: 'evaluation', config: { metrics: ['mse', 'r2'] }}
      ]
    }
  }
];
