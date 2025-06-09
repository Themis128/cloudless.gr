<template>
  <div class="faq-container">
    <h1 class="page-title">Frequently Asked Questions</h1>

    <div class="search-container">
      <input
        type="text"
        v-model="searchQuery"
        placeholder="Search FAQs..."
        class="search-input"
        @input="filterQuestions"
      />
    </div>

    <div class="faq-content">
      <div v-if="filteredQuestions.length > 0">
        <div v-for="(category, index) in uniqueCategories" :key="index" class="faq-category">
          <h2 class="category-title">{{ category }}</h2>

          <div class="faq-items">
            <div
              v-for="question in getQuestionsByCategory(category)"
              :key="question.id"
              class="faq-item"
            >
              <div
                class="faq-question"
                @click="toggleQuestion(question.id)"
                :class="{ active: expandedQuestions.includes(question.id) }"
              >
                <h3>{{ question.question }}</h3>
                <div class="icon">
                  <span v-if="expandedQuestions.includes(question.id)">−</span>
                  <span v-else>+</span>
                </div>
              </div>

              <div
                class="faq-answer"
                :class="{ expanded: expandedQuestions.includes(question.id) }"
              >
                <p v-html="question.answer"></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="no-results">
        <p>No FAQs found matching "{{ searchQuery }}"</p>
        <button @click="resetSearch" class="reset-button">Reset Search</button>
      </div>
    </div>

    <div class="contact-support">
      <h3>Still have questions?</h3>
      <p>Can't find what you're looking for? Our support team is here to help.</p>
      <NuxtLink to="/contact" class="contact-button">Contact Support</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';

  interface FAQ {
    id: number;
    question: string;
    answer: string;
    category: string;
  }

  const faqs = ref<FAQ[]>([
    {
      id: 1,
      question: 'What services does Cloudless provide?',
      answer:
        'Cloudless offers a comprehensive suite of web development, cloud infrastructure, and DevOps services. Our expertise includes frontend and backend development, serverless architecture, cloud deployments, CI/CD pipeline setup, and performance optimization.',
      category: 'Services',
    },
    {
      id: 2,
      question: 'How do I request a quote for my project?',
      answer:
        "You can request a quote by visiting our <a href='/contact' class='link'>Contact page</a> and filling out the form with details about your project requirements. Our team will review your request and get back to you within 1-2 business days with a customized quote.",
      category: 'Business',
    },
    {
      id: 3,
      question: 'Do you provide support after project completion?',
      answer:
        'Yes, we offer ongoing support and maintenance packages for all completed projects. Our support packages include regular updates, security patches, performance monitoring, and technical assistance. You can choose a support plan that best fits your needs during the project discussion phase.',
      category: 'Services',
    },
    {
      id: 4,
      question: 'What technologies do you specialize in?',
      answer:
        "We specialize in modern web technologies including Vue.js, React, Node.js, TypeScript, GraphQL, and serverless architecture. We're also experts in cloud platforms like AWS, Google Cloud, and Azure, as well as containerization with Docker and Kubernetes.",
      category: 'Technical',
    },
    {
      id: 5,
      question: 'How long does a typical project take to complete?',
      answer:
        "Project timelines vary based on complexity, scope, and requirements. A simple website might take 2-4 weeks, while a complex web application could take 3-6 months. During our initial consultation, we'll provide you with a detailed timeline based on your specific project needs.",
      category: 'Business',
    },
    {
      id: 6,
      question: 'Do you sign NDAs for client projects?',
      answer:
        "Absolutely. We respect the confidentiality of your ideas and business information. We're happy to sign a Non-Disclosure Agreement (NDA) before discussing the details of your project.",
      category: 'Business',
    },
    {
      id: 7,
      question: 'What is your development process like?',
      answer:
        'Our development process follows an agile methodology with iterative development cycles. We begin with a discovery phase to understand your requirements, followed by design, development, testing, deployment, and post-launch support. We maintain transparent communication throughout the project with regular updates and demonstrations.',
      category: 'Technical',
    },
    {
      id: 8,
      question: 'Can you help optimize my existing website or application?',
      answer:
        'Yes, we offer optimization services for existing websites and applications. Our team can perform code reviews, performance audits, security assessments, and implement improvements to enhance speed, user experience, and overall functionality.',
      category: 'Services',
    },
    {
      id: 9,
      question: 'Do you offer hosting services?',
      answer:
        "While we don't directly provide hosting services, we can help you set up, configure, and manage your hosting environment on cloud platforms like AWS, Google Cloud, or Azure. We can also recommend the best hosting solution based on your project requirements and budget.",
      category: 'Technical',
    },
    {
      id: 10,
      question: 'What payment methods do you accept?',
      answer:
        'We accept various payment methods including bank transfers, credit cards, and PayPal. For larger projects, we typically work with a milestone-based payment schedule, which will be outlined in our proposal and contract.',
      category: 'Business',
    },
    {
      id: 11,
      question: 'Can you help with SEO and digital marketing?',
      answer:
        'Yes, we offer SEO optimization as part of our web development process. This includes technical SEO setup, metadata optimization, schema markup, and performance improvements. For comprehensive digital marketing campaigns, we collaborate with trusted marketing partners to provide a complete solution.',
      category: 'Services',
    },
    {
      id: 12,
      question: 'How do you handle project changes and new requirements?',
      answer:
        'We understand that requirements can evolve during a project. We handle changes through a formal change request process. New requirements are evaluated for impact on timeline, scope, and budget, then discussed with you before implementation. This ensures transparency and helps manage expectations effectively.',
      category: 'Business',
    },
  ]);

  const searchQuery = ref('');
  const expandedQuestions = ref<number[]>([]);
  const filteredQuestions = ref<FAQ[]>([...faqs.value]);

  const uniqueCategories = computed(() => {
    const categories = filteredQuestions.value.map((faq) => faq.category);
    return [...new Set(categories)];
  });

  const filterQuestions = (): void => {
    if (!searchQuery.value.trim()) {
      filteredQuestions.value = [...faqs.value];
      return;
    }

    const query = searchQuery.value.toLowerCase();
    filteredQuestions.value = faqs.value.filter(
      (faq) =>
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.category.toLowerCase().includes(query)
    );
  };

  const resetSearch = (): void => {
    searchQuery.value = '';
    filteredQuestions.value = [...faqs.value];
  };

  const toggleQuestion = (id: number): void => {
    const index = expandedQuestions.value.indexOf(id);
    if (index >= 0) {
      expandedQuestions.value.splice(index, 1);
    } else {
      expandedQuestions.value.push(id);
    }
  };

  const getQuestionsByCategory = (category: string): FAQ[] => {
    return filteredQuestions.value.filter((faq) => faq.category === category);
  };

  onMounted(() => {
    // Expand the first question by default for better UX
    if (faqs.value.length > 0) {
      expandedQuestions.value = [faqs.value[0].id];
    }
  });
</script>

<style scoped>
  .faq-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .page-title {
    font-size: 2.25rem;
    margin-bottom: 2rem;
    color: #1e40af;
    text-align: center;
    font-weight: 700;
  }

  .search-container {
    margin-bottom: 2rem;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid rgba(203, 213, 225, 0.8);
    border-radius: 8px;
    background-color: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(5px);
    font-size: 1rem;
    transition: all 0.3s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
  }

  .faq-content {
    margin-bottom: 3rem;
  }

  .faq-category {
    margin-bottom: 2.5rem;
  }

  .category-title {
    font-size: 1.5rem;
    color: #1e40af;
    margin-bottom: 1.25rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid rgba(219, 234, 254, 0.6);
  }

  .faq-item {
    margin-bottom: 1rem;
  }

  .faq-question {
    background-color: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    padding: 1rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid rgba(219, 234, 254, 0.6);
    transition: all 0.3s;
  }

  .faq-question:hover {
    background-color: rgba(255, 255, 255, 0.95);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  .faq-question.active {
    background-color: rgba(219, 234, 254, 0.5);
    border-color: rgba(96, 165, 250, 0.6);
  }

  .faq-question h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1e293b;
    flex: 1;
  }

  .icon {
    font-size: 1.5rem;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    transition: transform 0.3s;
  }

  .faq-question.active .icon {
    color: #2563eb;
  }

  .faq-answer {
    background-color: rgba(255, 255, 255, 0.7);
    margin-top: 2px;
    padding: 0 1.5rem;
    max-height: 0;
    overflow: hidden;
    transition: all 0.3s ease-out;
    border-radius: 0 0 8px 8px;
    opacity: 0;
    border-left: 1px solid rgba(219, 234, 254, 0.6);
    border-right: 1px solid rgba(219, 234, 254, 0.6);
  }

  .faq-answer.expanded {
    padding: 1rem 1.5rem;
    max-height: 500px;
    opacity: 1;
    border-bottom: 1px solid rgba(219, 234, 254, 0.6);
  }

  .faq-answer p {
    margin: 0;
    line-height: 1.7;
    color: #334155;
  }

  .contact-support {
    background-color: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    padding: 2rem;
    border-radius: 8px;
    text-align: center;
    border: 1px solid rgba(219, 234, 254, 0.6);
  }

  .contact-support h3 {
    font-size: 1.5rem;
    color: #1e40af;
    margin-top: 0;
    margin-bottom: 0.75rem;
  }

  .contact-support p {
    color: #334155;
    margin-bottom: 1.5rem;
  }

  .contact-button {
    display: inline-block;
    background-color: #2563eb;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s;
  }

  .contact-button:hover {
    background-color: #1d4ed8;
    transform: translateY(-1px);
  }

  .no-results {
    background-color: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    padding: 2rem;
    border-radius: 8px;
    text-align: center;
    border: 1px solid rgba(219, 234, 254, 0.6);
  }

  .no-results p {
    color: #64748b;
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }

  .reset-button {
    background-color: #e2e8f0;
    color: #334155;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reset-button:hover {
    background-color: #cbd5e1;
  }

  .link {
    color: #2563eb;
    text-decoration: underline;
    transition: color 0.2s;
  }

  .link:hover {
    color: #1d4ed8;
  }

  @media (max-width: 768px) {
    .faq-question h3 {
      font-size: 1rem;
    }
  }
</style>
