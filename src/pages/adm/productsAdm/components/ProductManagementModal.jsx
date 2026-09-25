import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { isMobile } from "react-device-detect";

import {
  getDatabase,
  ref,
  get
} from "firebase/database";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll
} from "firebase/storage";

import imageCompression from "browser-image-compression";

import { useUserCompany } from "../../../../contexts/companyContext/UserCompanyContext";

import Modal from "../../../../components/modal/Modal";

import {
  BILLING_CYCLES,
  getPlanPriceSuffix,
  getPlanSessionsLabel,
  isSubscriptionProduct,
  normalizeMonthlyPlan
} from "../../../../utils/subscription";

import {
  buildPriceFields,
  getPromotion,
  validatePromotionalPrice
} from "../../../../utils/price";


const ProductManagementSlider = ({
  product,
  onClose,
  onSave
}) => {

  const DESCRIPTION_MAX_LENGTH = 2000;
  const MAX_IMAGES = 5;


  /*
  |--------------------------------------------------------------------------
  | DESCRIÇÃO
  |--------------------------------------------------------------------------
  */

  const getDescriptionTextLength = (html) => {

    const temp = document.createElement("div");

    temp.innerHTML = html || "";

    return (
      temp.textContent ||
      temp.innerText ||
      ""
    ).length;
  };


  const descriptionEditorRef = useRef(null);

  const [descriptionLength, setDescriptionLength] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemIndex, setNewItemIndex] = useState(null);
  const [removingItemIndex, setRemovingItemIndex] = useState(null);

  const [isMigratingImages, setIsMigratingImages] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState("");


  const handleDescriptionInput = (e) => {

    const editor = e.currentTarget;

    const html = editor.innerHTML;

    const text = getDescriptionTextLength(html);

    if (text > DESCRIPTION_MAX_LENGTH) {

      document.execCommand("undo");

      return;
    }

    setDescriptionLength(text);

    setEditedProduct(prev => ({
      ...prev,
      description: html
    }));
  };


  const execDescriptionCommand = (
    command,
    value = null
  ) => {

    const editor = descriptionEditorRef.current;

    if (!editor) return;

    editor.focus();

    document.execCommand(
      command,
      false,
      value
    );

    const html = editor.innerHTML;

    const temp = document.createElement("div");

    temp.innerHTML = html;

    const text =
      temp.textContent ||
      temp.innerText ||
      "";

    if (text.length > DESCRIPTION_MAX_LENGTH) {
      return;
    }

    setDescriptionLength(text.length);

    setEditedProduct(prev => ({
      ...prev,
      description: html
    }));
  };


  /*
  |--------------------------------------------------------------------------
  | ESTADO PRINCIPAL
  |--------------------------------------------------------------------------
  */

  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const [isSaving, setIsSaving] = useState(false);


  /*
  |--------------------------------------------------------------------------
  | PRODUTO EDITADO
  |--------------------------------------------------------------------------
  */

  const createEditedProduct = (currentProduct) => {

    const defaultSettings = {
      privacy: false,
      notifications: true,
      prepayment: false,
      rescheduling: true,
      dynamicPricing: [],
      extraFees: {
        timeBased: [],
        serviceBased: []
      }
    };

    return {
      ...currentProduct,

      /*
       * IMPORTANTE:
       *
       * Removemos images e image do estado principal.
       * As imagens agora pertencem ao Firebase Storage.
       */
      images: undefined,
      image: undefined,

      settings: {
        ...defaultSettings,
        ...(currentProduct?.settings || {})
      },

      bookingAdvance:
        currentProduct?.bookingAdvance || {
          days: 0,
          hours: 0,
          minutes: 0
        },

      cancellationAdvance:
        currentProduct?.cancellationAdvance || {
          days: 0,
          hours: 0,
          minutes: 0
        },

      /*
       * Produtos de assinatura sempre carregam o plano com
       * todos os campos preenchidos, mesmo os criados antes
       * de algum deles existir. Produtos avulsos recebem
       * null (e nunca undefined, que o RTDB rejeita).
       */
      monthlyPlan:
        normalizeMonthlyPlan(currentProduct) || null,

      /*
       * Promoção herdada que não é promoção.
       *
       * Boa parte dos produtos veio do banco com o preço
       * promocional IGUAL ao normal — resíduo de quando os
       * campos de desconto eram gravados na criação e nunca
       * mais atualizados. Abrir o produto já com isso limpo
       * evita que o dono veja um erro de validação sobre algo
       * que ele nem digitou.
       */
      discountedPrice:
        getPromotion(currentProduct)
          ? currentProduct.discountedPrice
          : ""
    };
  };


  const [editedProduct, setEditedProduct] = useState(
    () => createEditedProduct(product)
  );


  /*
  |--------------------------------------------------------------------------
  | ABAS
  |--------------------------------------------------------------------------
  */

  const [activeTab, setActiveTab] = useState("info");


  /*
  |--------------------------------------------------------------------------
  | CONFIGURAÇÕES DE ANTECEDÊNCIA
  |--------------------------------------------------------------------------
  */

  const [editingAdvance, setEditingAdvance] = useState(null);


  /*
  |--------------------------------------------------------------------------
  | DRAG MOBILE
  |--------------------------------------------------------------------------
  */

  const [startY, setStartY] = useState(null);
  const [currentY, setCurrentY] = useState(null);
  const [showDragHandle, setShowDragHandle] = useState(false);

  const sliderRef = useRef(null);
  const dragHandleRef = useRef(null);


  /*
  |--------------------------------------------------------------------------
  | IMAGENS
  |--------------------------------------------------------------------------
  |
  | AGORA:
  |
  | image:
  |   URL temporária para exibição
  |
  | file:
  |   File somente quando a imagem foi alterada
  |
  | As imagens reais ficam exclusivamente no Firebase Storage.
  |
  |--------------------------------------------------------------------------
  */

  const [carouselItems, setCarouselItems] = useState([]);


  /*
  |--------------------------------------------------------------------------
  | IMAGENS DO STORAGE
  |--------------------------------------------------------------------------
  |
  | Guardamos as referências que estavam originalmente no Storage.
  |
  | Isso permite:
  |
  | - descobrir quais arquivos existiam;
  | - reorganizar;
  | - remover imagens;
  | - sincronizar corretamente.
  |
  |--------------------------------------------------------------------------
  */

  const originalStorageImagesRef = useRef([]);


  /*
  |--------------------------------------------------------------------------
  | USUÁRIOS RELACIONADOS
  |--------------------------------------------------------------------------
  */

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  const {
    company,
    members = []
  } = useUserCompany();

  const [userSearch, setUserSearch] = useState("");


  const filteredUsers = members.filter(member => {

    const alreadyAdded =
      editedProduct.relatedUsers?.some(
        related => related.id === member.uid
      );

    return (
      !alreadyAdded &&
      member.name
        ?.toLowerCase()
        .includes(userSearch.toLowerCase())
    );
  });


  const handleAddRelatedUser = (user) => {

    setEditedProduct(prev => ({

      ...prev,

      relatedUsers: [

        ...(prev.relatedUsers || []),

        {
          id: user.uid,
          role: user.role,
          name: user.name
        }

      ]

    }));

    setUserSearch("");

    setIsAddUserOpen(false);
  };


  /*
  |--------------------------------------------------------------------------
  | ADICIONAR ESPAÇO DE IMAGEM
  |--------------------------------------------------------------------------
  */

  const handleAddItem = () => {

    if (carouselItems.length >= MAX_IMAGES) {

      alert(
        `Você atingiu o limite máximo de ${MAX_IMAGES} fotos.`
      );

      return;
    }

    setIsAddingItem(true);

    const newId =
      carouselItems.length > 0
        ? Math.max(
          ...carouselItems.map(item => item.id)
        ) + 1
        : 1;

    setCarouselItems(prev => [
      ...prev,
      {
        id: newId,
        image: null,
        file: null
      }
    ]);

    setNewItemIndex(carouselItems.length);
  };


  /*
  |--------------------------------------------------------------------------
  | REMOVER IMAGEM DO CAROUSEL
  |--------------------------------------------------------------------------
  |
  | A remoção física do Storage acontece somente durante o Save.
  |
  |--------------------------------------------------------------------------
  */

  const handleRemoveItem = (index) => {

    setRemovingItemIndex(index);

    setTimeout(() => {

      setCarouselItems(prev =>
        prev.filter((_, i) => i !== index)
      );

      setRemovingItemIndex(null);

    }, 300);
  };


  /*
  |--------------------------------------------------------------------------
  | SELECIONAR NOVA IMAGEM
  |--------------------------------------------------------------------------
  */

  const handleImageUpload = (event, index) => {

    const file = event.target.files?.[0];

    if (!file) return;


    if (!file.type.startsWith("image/")) {

      alert("Selecione um arquivo de imagem válido.");

      event.target.value = "";

      return;
    }


    const reader = new FileReader();

    reader.onload = (e) => {

      const previewUrl = e.target.result;

      setCarouselItems(prev =>
        prev.map((item, i) => {

          if (i !== index) {
            return item;
          }

          return {
            ...item,
            image: previewUrl,
            file
          };

        })
      );
    };


    reader.onerror = () => {

      alert(
        "Não foi possível carregar a imagem selecionada."
      );
    };


    reader.readAsDataURL(file);


    event.target.value = "";
  };


  /*
  |--------------------------------------------------------------------------
  | FINALIZAR ANIMAÇÃO DE ADIÇÃO
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    if (
      isAddingItem &&
      newItemIndex !== null
    ) {

      const timer = setTimeout(() => {

        setIsAddingItem(false);
        setNewItemIndex(null);

      }, 300);

      return () => clearTimeout(timer);
    }

  }, [
    isAddingItem,
    newItemIndex
  ]);


  /*
  |--------------------------------------------------------------------------
  | STORAGE
  |--------------------------------------------------------------------------
  */

  const getProductImagesStorageRef = (
    companyHandle,
    productId
  ) => {

    const storage = getStorage();

    return storageRef(
      storage,
      `companys/${companyHandle}/products/${productId}/images`
    );
  };

  /*
  |--------------------------------------------------------------------------
  | CARREGAR IMAGENS DO STORAGE
  |--------------------------------------------------------------------------
  */

  const loadProductStorageImages = async (
    companyHandle,
    productId
  ) => {

    if (!companyHandle || !productId) {
      return [];
    }


    const folderRef =
      getProductImagesStorageRef(
        companyHandle,
        productId
      );


    const result =
      await listAll(folderRef);


    /*
     * Ordenação numérica:
     *
     * image_0.jpg
     * image_1.jpg
     * image_2.jpg
     */

    const sortedItems =
      [...result.items].sort(
        (a, b) => {

          const getIndex = (name) => {

            const match =
              name.match(
                /image_(\d+)/
              );

            return match
              ? Number(match[1])
              : Number.MAX_SAFE_INTEGER;
          };

          return (
            getIndex(a.name) -
            getIndex(b.name)
          );

        }
      );


    const images =
      await Promise.all(
        sortedItems.map(
          async (itemRef) => {

            const url =
              await getDownloadURL(
                itemRef
              );

            return {
              name: itemRef.name,
              path: itemRef.fullPath,
              url
            };

          }
        )
      );


    return images;
  };


  /*
  |--------------------------------------------------------------------------
  | SINCRONIZA PRODUTO QUANDO MUDA
  |--------------------------------------------------------------------------
  |
  | AGORA NÃO LEMOS product.images.
  |
  | As imagens são carregadas diretamente do Storage.
  |
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    let cancelled = false;


    const initializeProduct = async () => {

      if (!product) return;


      setIsLoading(true);


      setEditedProduct(
        createEditedProduct(product)
      );


      setCarouselItems([]);


      originalStorageImagesRef.current = [];


      const companyHandle =
        company?.handle;


      const productId =
        product?.id;


      try {

        if (
          companyHandle &&
          productId
        ) {

          const storageImages =
            await loadProductStorageImages(
              companyHandle,
              productId
            );


          if (cancelled) {
            return;
          }


          originalStorageImagesRef.current =
            storageImages;


          setCarouselItems(
            storageImages.map(
              (image, index) => ({

                id: index + 1,

                /*
                 * URL somente para exibição.
                 * NÃO vai para o RTDB.
                 */
                image: image.url,

                /*
                 * null = arquivo já existente
                 * no Storage.
                 */
                file: null,

                /*
                 * Nome físico do arquivo.
                 */
                storageName:
                  image.name,

                /*
                 * Caminho físico.
                 */
                storagePath:
                  image.path

              })
            )
          );

        }

      } catch (error) {

        console.error(
          "Erro ao carregar imagens do Storage:",
          error
        );

        /*
         * Se não existem imagens,
         * simplesmente deixamos o carousel vazio.
         *
         * listAll retorna lista vazia normalmente.
         */

        if (!cancelled) {

          setCarouselItems([]);

        }

      } finally {

        if (!cancelled) {

          setActiveTab("info");
          setEditingAdvance(null);
          setIsClosing(false);
          setIsSaving(false);

          setShowDragHandle(isMobile);

          setIsLoading(false);

        }

      }

    };


    initializeProduct();


    document.body.style.overflow = "hidden";


    return () => {

      cancelled = true;

      document.body.style.overflow = "";

    };

  }, [
    product,
    company?.handle
  ]);


  /*
  |--------------------------------------------------------------------------
  | ANIMAÇÃO DE ABERTURA
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    setIsLoading(true);

    const timer = setTimeout(() => {

      setIsVisible(true);

    }, 100);


    document.body.style.overflow = "hidden";

    setShowDragHandle(isMobile);


    return () => {

      clearTimeout(timer);

      document.body.style.overflow = "";

    };

  }, [product]);


  /*
  |--------------------------------------------------------------------------
  | FECHAR
  |--------------------------------------------------------------------------
  */

  const handleClose = () => {

    if (isSaving) return;


    setIsVisible(false);
    setIsClosing(true);


    setTimeout(() => {

      onClose();

      setIsClosing(false);

    }, 300);
  };


  /*
  |--------------------------------------------------------------------------
  | EDITOR DE DESCRIÇÃO
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    if (isLoading) return;

    const editor =
      descriptionEditorRef.current;

    if (!editor) return;

    const description =
      product?.description || "";


    editor.innerHTML = description;


    setDescriptionLength(
      Math.min(
        getDescriptionTextLength(description),
        DESCRIPTION_MAX_LENGTH
      )
    );

  }, [
    product,
    isLoading
  ]);


  /*
  |--------------------------------------------------------------------------
  | ANTECEDÊNCIA
  |--------------------------------------------------------------------------
  */

  const handleAdvanceChange = (
    type,
    field,
    value
  ) => {

    if (value === "") {

      setEditedProduct(prev => ({

        ...prev,

        [type]: {

          ...(prev[type] || {}),

          [field]: ""

        }

      }));

      return;
    }


    value = value.replace(/\D/g, "");


    let numericValue =
      Number(value);


    if (field === "hours") {

      numericValue =
        Math.min(
          23,
          numericValue
        );
    }


    if (field === "minutes") {

      numericValue =
        Math.min(
          59,
          numericValue
        );
    }


    if (field === "days") {

      numericValue =
        Math.max(
          0,
          numericValue
        );
    }


    setEditedProduct(prev => ({

      ...prev,

      [type]: {

        ...(prev[type] || {}),

        [field]: numericValue

      }

    }));
  };


  /*
  |--------------------------------------------------------------------------
  | CONVERTER URL DO STORAGE PARA FILE
  |--------------------------------------------------------------------------
  |
  | Necessário quando uma imagem existente foi mantida.
  |
  | Como vamos reorganizar:
  |
  | image_0
  | image_1
  | image_2
  |
  | precisamos reenviar as imagens existentes para seus
  | novos índices.
  |
  |--------------------------------------------------------------------------
  */

  const downloadStorageImageAsFile = async (
    imageUrl,
    index
  ) => {

    if (
      !imageUrl ||
      typeof imageUrl !== "string"
    ) {

      throw new Error(
        `Imagem ${index + 1} inválida.`
      );

    }


    let response;

    try {

      response = await fetch(imageUrl);

    } catch (error) {

      /*
       * "Failed to fetch" aqui quer dizer CORS.
       *
       * Ler um arquivo do Storage pelo navegador exige que o
       * bucket permita a origem que está pedindo. A mensagem
       * crua não diz isso a ninguém — e o dono da empresa
       * ficava achando que o produto não salvava.
       */
      throw new Error(
        "Não foi possível reorganizar as imagens: o Storage " +
        "recusou a leitura (CORS). Salve sem mexer na ordem " +
        "das fotos, ou peça para liberar o domínio no bucket."
      );

    }


    if (!response.ok) {

      throw new Error(
        `Não foi possível carregar a imagem ${index + 1}.`
      );

    }


    const blob =
      await response.blob();


    return new File(
      [blob],
      `image_${index}.jpg`,
      {
        type:
          blob.type ||
          "image/jpeg"
      }
    );
  };


  /*
  |--------------------------------------------------------------------------
  | EXCLUIR ARQUIVOS DO STORAGE
  |--------------------------------------------------------------------------
  */

  const deleteStorageImage = async (
    imageRef
  ) => {

    if (!imageRef) {
      return;
    }


    try {

      await deleteObject(
        imageRef
      );

    } catch (error) {

      /*
       * Se já não existir, não interrompe.
       */

      if (
        error?.code !==
        "storage/object-not-found"
      ) {

        console.warn(
          "Não foi possível remover imagem antiga do Storage:",
          error
        );
      }

    }
  };


  /*
  |--------------------------------------------------------------------------
  | SINCRONIZAR IMAGENS DO STORAGE
  |--------------------------------------------------------------------------
  |
  | Esta é a parte principal.
  |
  | O Storage sempre termina exatamente assim:
  |
  | images/
  | ├── image_0.jpg
  | ├── image_1.jpg
  | ├── image_2.jpg
  | ├── image_3.jpg
  | └── image_4.jpg
  |
  | somente enquanto existirem imagens nesses índices.
  |
  |--------------------------------------------------------------------------
  */

  const syncProductImages = async ({
    companyHandle,
    productId,
    items
  }) => {

    const storage =
      getStorage();


    /*
    |--------------------------------------------------------------------------
    | REFERÊNCIA DA PASTA
    |--------------------------------------------------------------------------
    */

    const folderRef =
      storageRef(
        storage,
        `companys/${companyHandle}/products/${productId}/images`
      );


    /*
    |--------------------------------------------------------------------------
    | LISTA ATUAL DO STORAGE
    |--------------------------------------------------------------------------
    */

    const existingStorage =
      await listAll(
        folderRef
      );


    /*
    |--------------------------------------------------------------------------
    | NADA MUDOU NAS IMAGENS?
    |--------------------------------------------------------------------------
    |
    | Então não encoste no Storage.
    |
    | O fluxo abaixo REENVIA todas as imagens a cada
    | salvamento, porque o nome do arquivo carrega a posição
    | (image_0, image_1...) e reordenar exige reescrever
    | todos. Para isso ele baixa as antigas — e baixar uma URL
    | do Storage pelo navegador depende de CORS configurado no
    | bucket. Sem isso o salvamento inteiro morria com
    | "Failed to fetch", mesmo quando a pessoa só queria
    | corrigir o preço.
    |
    | Também evita recomprimir JPEG já comprimido a cada
    | edição, que degrada a imagem um pouco mais de cada vez.
    |
    |--------------------------------------------------------------------------
    */

    const houveMudancaNasImagens =
      items.some(item => item?.file) ||
      items.filter(item => item?.image).length !==
        existingStorage.items.length;

    if (!houveMudancaNasImagens) {

      return items
        .filter(item => item?.image)
        .map(item => item.image);

    }


    /*
    |--------------------------------------------------------------------------
    | IMAGENS QUE O USUÁRIO DEIXOU
    |--------------------------------------------------------------------------
    */

    const finalItems =
      items.filter(
        item =>
          item?.image
      );


    /*
    |--------------------------------------------------------------------------
    | NENHUMA IMAGEM
    |--------------------------------------------------------------------------
    |
    | Se o usuário removeu tudo,
    | limpamos toda a pasta.
    |
    |--------------------------------------------------------------------------
    */

    if (
      finalItems.length === 0
    ) {

      await Promise.all(
        existingStorage.items.map(
          itemRef =>
            deleteStorageImage(
              itemRef
            )
        )
      );

      return [];
    }


    /*
    |--------------------------------------------------------------------------
    | PREPARAR TODAS AS IMAGENS
    |--------------------------------------------------------------------------
    |
    | Primeiro baixamos as imagens antigas.
    |
    | Isso é importante porque:
    |
    | image_0 = A
    | image_1 = B
    | image_2 = C
    |
    | se B for removida:
    |
    | A
    | C
    |
    | precisamos transformar:
    |
    | image_0 = A
    | image_1 = C
    |
    |--------------------------------------------------------------------------
    */

    const filesToUpload =
      await Promise.all(
        finalItems.map(
          async (item, index) => {

            /*
            |--------------------------------------------------------------------------
            | IMAGEM NOVA
            |--------------------------------------------------------------------------
            */

            if (item.file) {

              return item.file;
            }


            /*
            |--------------------------------------------------------------------------
            | IMAGEM EXISTENTE
            |--------------------------------------------------------------------------
            */

            return await downloadStorageImageAsFile(
              item.image,
              index
            );

          }
        )
      );


    /*
    |--------------------------------------------------------------------------
    | UPLOAD DOS NOVOS ARQUIVOS
    |--------------------------------------------------------------------------
    |
    | Usamos nomes fixos:
    |
    | image_0.jpg
    | image_1.jpg
    | image_2.jpg
    |
    |--------------------------------------------------------------------------
    */

    const uploadedFiles = [];


    for (
      let index = 0;
      index < filesToUpload.length;
      index++
    ) {

      const file =
        filesToUpload[index];


      /*
      |--------------------------------------------------------------------------
      | COMPRESSÃO
      |--------------------------------------------------------------------------
      */

      const compressedFile =
        await imageCompression(
          file,
          {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 1280,
            useWebWorker: true,

            /*
             * Padroniza todas as imagens.
             */

            fileType: "image/jpeg",

            initialQuality: 0.82
          }
        );


      /*
      |--------------------------------------------------------------------------
      | NOME
      |--------------------------------------------------------------------------
      */

      const fileName =
        `image_${index}.jpg`;


      /*
      |--------------------------------------------------------------------------
      | CAMINHO
      |--------------------------------------------------------------------------
      */

      const imagePath =
        `companys/${companyHandle}/products/${productId}/images/${fileName}`;


      const imageRef =
        storageRef(
          storage,
          imagePath
        );


      /*
      |--------------------------------------------------------------------------
      | UPLOAD
      |--------------------------------------------------------------------------
      */

      await uploadBytes(
        imageRef,
        compressedFile,
        {
          contentType: "image/jpeg"
        }
      );


      /*
      |--------------------------------------------------------------------------
      | URL
      |--------------------------------------------------------------------------
      */

      const downloadUrl =
        await getDownloadURL(
          imageRef
        );


      uploadedFiles.push({
        name: fileName,
        path: imagePath,
        url: downloadUrl
      });

    }


    /*
    |--------------------------------------------------------------------------
    | REMOVER ARQUIVOS SOBRANDO
    |--------------------------------------------------------------------------
    |
    | Exemplo:
    |
    | Antes:
    |
    | image_0.jpg
    | image_1.jpg
    | image_2.jpg
    | image_3.jpg
    |
    | Agora:
    |
    | image_0.jpg
    | image_1.jpg
    |
    | image_2 e image_3 são apagadas.
    |
    |--------------------------------------------------------------------------
    */

    const validNames =
      new Set(
        uploadedFiles.map(
          file =>
            file.name
        )
      );


    await Promise.all(
      existingStorage.items.map(
        async existingRef => {

          if (
            !validNames.has(
              existingRef.name
            )
          ) {

            await deleteStorageImage(
              existingRef
            );

          }

        }
      )
    );


    /*
    |--------------------------------------------------------------------------
    | ATUALIZA REFERÊNCIA LOCAL
    |--------------------------------------------------------------------------
    */

    originalStorageImagesRef.current =
      uploadedFiles;


    return uploadedFiles;
  };


  /*
  |--------------------------------------------------------------------------
  | SALVAR PRODUTO
  |--------------------------------------------------------------------------
  |
  | IMPORTANTE:
  |
  | O RTDB NÃO RECEBE:
  |
  | images
  | image
  |
  | As imagens ficam exclusivamente no Storage.
  |
  |--------------------------------------------------------------------------
  */

  const handleSave = async () => {

    if (isSaving) return;

    /*
     * Promoção maior que o preço não é promoção.
     *
     * Este bloco já existiu com um `return` seco: o botão de
     * salvar simplesmente não fazia nada, sem dizer por quê.
     * E como a maioria dos produtos tinha preço promocional
     * igual ao normal vindo do banco, isso travava quase toda
     * edição — inclusive quem só queria mudar o preço.
     *
     * Agora a mensagem aparece, e o produto abre com a
     * promoção inválida já limpa (ver o efeito de saneamento
     * mais abaixo), então o caso antigo nem chega aqui.
     */
    const erroDePromocao =
      validatePromotionalPrice(
        editedProduct?.value,
        editedProduct?.discountedPrice
      );

    if (erroDePromocao) {

      setSaveError(erroDePromocao);

      return;
    }

    setSaveError("");


    setIsSaving(true);


    try {

      /*
      |--------------------------------------------------------------------------
      | EMPRESA
      |--------------------------------------------------------------------------
      */

      const companyHandle =
        company?.handle;


      if (!companyHandle) {

        throw new Error(
          "Empresa não identificada."
        );
      }


      /*
      |--------------------------------------------------------------------------
      | PRODUTO
      |--------------------------------------------------------------------------
      */

      const productId =
        product?.id;


      if (!productId) {

        throw new Error(
          "ID do produto não identificado."
        );
      }


      /*
      |--------------------------------------------------------------------------
      | SINCRONIZA STORAGE
      |--------------------------------------------------------------------------
      */

      await syncProductImages({

        companyHandle,

        productId,

        items:
          carouselItems

      });


      /*
      |--------------------------------------------------------------------------
      | REMOVER IMAGENS DO OBJETO DO RTDB
      |--------------------------------------------------------------------------
      |
      | Mesmo que editedProduct venha de um produto antigo
      | que ainda tenha images/image no banco, eles não serão
      | enviados novamente.
      |
      |--------------------------------------------------------------------------
      */

      const {
        images,
        image,
        ...productWithoutImages
      } = editedProduct;


      /*
      |--------------------------------------------------------------------------
      | PRODUTO FINAL
      |--------------------------------------------------------------------------
      */

      /*
      |--------------------------------------------------------------------------
      | PREÇOS COERENTES
      |--------------------------------------------------------------------------
      |
      | Nunca gravamos o que está nos inputs direto: os campos
      | de desconto são derivados aqui, e apagados quando não
      | há promoção válida. É o que impede o produto de voltar
      | a anunciar uma porcentagem que não corresponde a
      | preço nenhum.
      |
      */

      const productToSave = {

        ...productWithoutImages,

        ...buildPriceFields({
          value: productWithoutImages.value,
          promotionalPrice: productWithoutImages.discountedPrice,
          isSubscription:
            isSubscriptionProduct(productWithoutImages),
          monthlyPlan: productWithoutImages.monthlyPlan
        })

      };


      /*
      |--------------------------------------------------------------------------
      | SALVAR RTDB
      |--------------------------------------------------------------------------
      */

      const success =
        await onSave(
          productToSave
        );


      if (!success) {

        throw new Error(
          "Não foi possível salvar o produto."
        );
      }


      /*
      |--------------------------------------------------------------------------
      | FINALIZADO
      |--------------------------------------------------------------------------
      */

      handleClose();


    } catch (error) {

      console.error(
        "Erro ao salvar produto:",
        error
      );

      setSaveError(
        error?.message ||
        "Não foi possível salvar o produto."
      );


      alert(
        error?.message ||
        "Não foi possível salvar as alterações."
      );


    } finally {

      setIsSaving(false);

    }

  };


  /*
  |--------------------------------------------------------------------------
  | INPUTS
  |--------------------------------------------------------------------------
  */

  const handleInputChange = (e) => {

    const {
      name,
      value
    } = e.target;


    setEditedProduct(prev => ({

      ...prev,

      [name]: value

    }));
  };


  /*
  |--------------------------------------------------------------------------
  | PREÇO E PROMOÇÃO
  |--------------------------------------------------------------------------
  |
  | Os dois campos que o dono edita. A porcentagem NÃO é um
  | deles: ela é calculada, senão volta a divergir do preço
  | como estava antes — produto anunciando 40% num desconto
  | de 20%, e promoção com valor igual ao normal.
  |
  */

  /* Motivo pelo qual o último salvamento não aconteceu. */
  const [saveError, setSaveError] = useState("");


  const promotion =
    getPromotion(editedProduct);

  const promotionError =
    validatePromotionalPrice(
      editedProduct?.value,
      editedProduct?.discountedPrice
    );


  /*
  |--------------------------------------------------------------------------
  | PLANO DE MENSALIDADE
  |--------------------------------------------------------------------------
  |
  | Só existe para produtos do tipo "monthly". O patch é
  | aplicado sobre o plano normalizado, então nenhum campo
  | some ao editar apenas um deles.
  |
  */

  const isSubscription =
    isSubscriptionProduct(editedProduct);


  const monthlyPlan =
    editedProduct?.monthlyPlan || null;


  const updateMonthlyPlan = (patch) => {

    setEditedProduct(prev => ({

      ...prev,

      monthlyPlan: {
        ...(prev.monthlyPlan || {}),
        ...patch
      }

    }));
  };


  const handlePlanNumberChange = (
    field,
    rawValue
  ) => {

    const parsed =
      parseInt(rawValue, 10);


    updateMonthlyPlan({
      [field]:
        Number.isNaN(parsed) || parsed < 0
          ? 0
          : parsed
    });
  };


  /*
  |--------------------------------------------------------------------------
  | STATUS
  |--------------------------------------------------------------------------
  */

  const handleStatusChange = (
    newStatus
  ) => {

    setEditedProduct(prev => ({

      ...prev,

      status: newStatus

    }));
  };


  /*
  |--------------------------------------------------------------------------
  | DURAÇÃO
  |--------------------------------------------------------------------------
  */

  const formatDuration = (
    minutes
  ) => {

    if (!minutes) {
      return "0m";
    }


    const hours =
      Math.floor(
        minutes / 60
      );


    const mins =
      minutes % 60;


    return hours > 0
      ? `${hours}h ${mins}m`
      : `${mins}m`;
  };


  /*
  |--------------------------------------------------------------------------
  | TOUCH START
  |--------------------------------------------------------------------------
  */

  const handleTouchStart = (e) => {

    if (!showDragHandle) {
      return;
    }


    const touchTarget =
      e.target;


    if (
      !dragHandleRef.current ||
      !dragHandleRef.current.contains(
        touchTarget
      )
    ) {
      return;
    }


    setStartY(
      e.touches[0].clientY
    );

    setCurrentY(
      e.touches[0].clientY
    );
  };


  /*
  |--------------------------------------------------------------------------
  | TOUCH MOVE
  |--------------------------------------------------------------------------
  */

  const handleTouchMove = (e) => {

    if (
      !showDragHandle ||
      startY === null
    ) {
      return;
    }


    const newY =
      e.touches[0].clientY;


    setCurrentY(
      newY
    );


    const deltaY =
      newY - startY;


    if (deltaY > 0) {

      e.currentTarget.style.transform =
        `translateY(${deltaY}px)`;
    }
  };


  /*
  |--------------------------------------------------------------------------
  | TOUCH END
  |--------------------------------------------------------------------------
  */

  const handleTouchEnd = () => {

    if (
      !showDragHandle ||
      startY === null ||
      currentY === null
    ) {
      return;
    }


    const distance =
      currentY - startY;


    if (distance > 100) {

      handleClose();

    } else {

      if (sliderRef.current) {

        sliderRef.current.style.transform =
          "translateY(0)";
      }
    }


    setStartY(null);
    setCurrentY(null);
  };


  /*
  |--------------------------------------------------------------------------
  | TROCAR ABA
  |--------------------------------------------------------------------------
  */

  const changeTab = (
    tab
  ) => {

    if (
      tab !== activeTab
    ) {

      setIsLoading(true);

      setActiveTab(tab);


      setTimeout(() => {

        setIsLoading(false);

      }, 500);
    }
  };


  /*
  |--------------------------------------------------------------------------
  | CARREGAR USUÁRIOS RELACIONADOS
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    const loadRelatedUsers =
      async () => {

        if (
          !editedProduct?.relatedUsers?.length
        ) {
          return;
        }


        const db =
          getDatabase();


        const usersWithNames =
          await Promise.all(

            editedProduct.relatedUsers.map(
              async user => {

                const snap =
                  await get(
                    ref(
                      db,
                      `users/${user.id}`
                    )
                  );


                return {

                  ...user,

                  name:
                    snap.exists()
                      ? snap.val().name ||
                      "Sem nome"
                      : "Usuário não encontrado"

                };
              }
            )
          );


        setEditedProduct(prev => ({

          ...prev,

          relatedUsers:
            usersWithNames

        }));
      };


    loadRelatedUsers();

  }, [product]);


  /*
  |--------------------------------------------------------------------------
  | REMOVER USUÁRIO RELACIONADO
  |--------------------------------------------------------------------------
  */

  const handleRemoveRelatedUser = (
    userId
  ) => {

    setEditedProduct(prev => ({

      ...prev,

      relatedUsers:
        (prev.relatedUsers || [])
          .filter(
            user =>
              user.id !== userId
          )

    }));
  };


  /*
  |--------------------------------------------------------------------------
  | SKELETON
  |--------------------------------------------------------------------------
  */

  const renderSkeleton = () => {

    switch (activeTab) {

      /*
      |--------------------------------------------------------------------------
      | INFO
      |--------------------------------------------------------------------------
      */

      case "info":

        return (

          <div className="pms-content">

            <div className="pms-section">

              <div className="pms-skeleton pms-skeleton-header"></div>

              <div className="pms-skeleton pms-skeleton-text"></div>

              <div className="pms-skeleton pms-skeleton-input"></div>

              <div className="pms-skeleton pms-skeleton-text"></div>

              <div className="pms-skeleton pms-skeleton-textarea"></div>

              <div className="pms-skeleton pms-skeleton-text"></div>

              <div className="pms-status-btns">

                <div className="pms-skeleton pms-skeleton-button"></div>

                <div className="pms-skeleton pms-skeleton-button"></div>

              </div>

            </div>


            <div className="pms-section">

              <div className="pms-skeleton pms-skeleton-header"></div>

              <div className="pms-skeleton pms-skeleton-text"></div>

              <div className="pms-skeleton pms-skeleton-input"></div>

              <div className="pms-skeleton pms-skeleton-text"></div>

              <div className="pms-skeleton pms-skeleton-input"></div>

            </div>


            <div className="pms-section">

              <div className="pms-skeleton pms-skeleton-header"></div>

              <div className="pms-skeleton pms-skeleton-text"></div>

              <div className="pms-categories">

                <div
                  className="pms-skeleton pms-skeleton-button"
                  style={{
                    width: "80px"
                  }}
                />

                <div
                  className="pms-skeleton pms-skeleton-button"
                  style={{
                    width: "100px"
                  }}
                />

              </div>

            </div>

          </div>

        );


      /*
      |--------------------------------------------------------------------------
      | IMAGENS
      |--------------------------------------------------------------------------
      */

      case "images":

        return (

          <div className="pms-content">

            <div className="pms-skeleton pms-skeleton-header"></div>

            <div className="pms-images-grid">

              {[...Array(3)].map(
                (_, i) => (

                  <div
                    key={i}
                    className="pms-image-item"
                  >

                    <div className="pms-skeleton pms-skeleton-image"></div>

                  </div>

                )
              )}

            </div>


            <div className="pms-skeleton pms-skeleton-button"></div>

            <div
              className="pms-skeleton pms-skeleton-text-sm"
              style={{
                marginTop: "8px"
              }}
            />

          </div>

        );


      /*
      |--------------------------------------------------------------------------
      | SETTINGS
      |--------------------------------------------------------------------------
      */

      case "settings":

        return (

          <div className="pms-content">

            <div className="pms-section">

              <div className="pms-skeleton pms-skeleton-header"></div>


              {[...Array(4)].map(
                (_, i) => (

                  <div
                    key={i}
                    className="pms-setting-item"
                  >

                    <div
                      className="pms-skeleton pms-skeleton-text"
                      style={{
                        width: "70%"
                      }}
                    />

                    <div className="pms-skeleton pms-skeleton-text-sm"></div>

                    <div
                      className="pms-skeleton pms-skeleton-button"
                      style={{
                        width: "60px",
                        height: "20px"
                      }}
                    />

                  </div>

                )
              )}

            </div>


            <div className="pms-section">

              <div className="pms-skeleton pms-skeleton-header"></div>

              <div className="pms-users-list">

                {[...Array(2)].map(
                  (_, i) => (

                    <div
                      key={i}
                      className="pms-user-item"
                    >

                      <div className="pms-skeleton pms-skeleton-avatar"></div>

                      <div
                        style={{
                          flex: 1
                        }}
                      >

                        <div
                          className="pms-skeleton pms-skeleton-text"
                          style={{
                            width: "60%"
                          }}
                        />

                        <div
                          className="pms-skeleton pms-skeleton-text-sm"
                          style={{
                            width: "40%"
                          }}
                        />

                      </div>

                    </div>

                  )
                )}

              </div>


              <div className="pms-skeleton pms-skeleton-button"></div>

            </div>

          </div>

        );


      default:
        return null;
    }
  };


  /*
  |--------------------------------------------------------------------------
  | FINALIZAR EDIÇÃO DE ANTECEDÊNCIA
  |--------------------------------------------------------------------------
  */

  const finishAdvanceEdit = (
    type
  ) => {

    setEditedProduct(prev => ({

      ...prev,

      [type]: {

        days:
          Number(
            prev[type]?.days
          ) || 0,

        hours:
          Math.min(
            23,
            Number(
              prev[type]?.hours
            ) || 0
          ),

        minutes:
          Math.min(
            59,
            Number(
              prev[type]?.minutes
            ) || 0
          )

      }

    }));


    setEditingAdvance(null);
  };


  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (

    <div
      className={`pms-overlay ${isVisible
        ? "visible"
        : ""
        }`}
      onClick={handleClose}
    >

      <div
        ref={sliderRef}
        className={`pms-slider ${isClosing
          ? "closing"
          : ""
          }`}
        onClick={(e) =>
          e.stopPropagation()
        }
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >

        {showDragHandle && (

          <div
            ref={dragHandleRef}
            className="pms-drag-handle"
          >

            <div className="pms-drag-indicator" />

          </div>

        )}


        {/* HEADER */}

        <div className="pms-header">

          <h2>
            Gerenciar Produto
          </h2>

          <p>
            ID: #{product.id}
          </p>

        </div>


        {/* TABS */}

        <div className="pms-tabs">

          <button
            className={`pms-tab-btn ${activeTab === "info"
              ? "active"
              : ""
              }`}
            onClick={() =>
              changeTab("info")
            }
          >
            Informações
          </button>


          <button
            className={`pms-tab-btn ${activeTab === "images"
              ? "active"
              : ""
              }`}
            onClick={() =>
              changeTab("images")
            }
          >
            Imagens
          </button>


          <button
            className={`pms-tab-btn ${activeTab === "settings"
              ? "active"
              : ""
              }`}
            onClick={() =>
              changeTab("settings")
            }
          >
            Configurações
          </button>

        </div>


        {/* CONTENT */}

        <div className="pms-content-container">

          {isLoading
            ? renderSkeleton()
            : (

              <>

                {/* ======================================================
                    INFORMAÇÕES
                ====================================================== */}

                {activeTab === "info" && (

                  <div className="pms-content">

                    <div className="pms-section">

                      <h3 className="pms-section-title">
                        Informações Básicas
                      </h3>


                      <div className="adm_products-modal-input-group">

                        <label htmlFor="input1">
                          Nome do produto
                        </label>

                        <input
                          type="text"
                          name="name"
                          value={
                            editedProduct.name || ""
                          }
                          onChange={
                            handleInputChange
                          }
                          className="adm_products-modal-input"
                        />

                      </div>


                      <div className="adm_products-modal-input-group">

                        <label>
                          Descrição
                        </label>


                        <div className="pms-description-editor">

                          <div className="pms-description-toolbar">

                            <button
                              type="button"
                              title="Negrito"
                              onMouseDown={(e) => {

                                e.preventDefault();

                                execDescriptionCommand(
                                  "bold"
                                );

                              }}
                            >
                              <strong>
                                B
                              </strong>
                            </button>


                            <button
                              type="button"
                              title="Itálico"
                              onMouseDown={(e) => {

                                e.preventDefault();

                                execDescriptionCommand(
                                  "italic"
                                );

                              }}
                            >
                              <em>
                                I
                              </em>
                            </button>


                            <span className="pms-description-toolbar-divider" />


                            <button
                              type="button"
                              title="Lista"
                              onMouseDown={(e) => {

                                e.preventDefault();

                                execDescriptionCommand(
                                  "insertUnorderedList"
                                );

                              }}
                            >
                              <Icon icon="lucide:list" />
                            </button>


                            <button
                              type="button"
                              title="Lista numerada"
                              onMouseDown={(e) => {

                                e.preventDefault();

                                execDescriptionCommand(
                                  "insertOrderedList"
                                );

                              }}
                            >
                              <Icon icon="lucide:list-ordered" />
                            </button>


                            <span className="pms-description-toolbar-divider" />


                            <button
                              type="button"
                              title="Parágrafo"
                              onMouseDown={(e) => {

                                e.preventDefault();

                                execDescriptionCommand(
                                  "formatBlock",
                                  "p"
                                );

                              }}
                            >
                              <Icon icon="lucide:pilcrow" />
                            </button>

                          </div>


                          <div
                            ref={
                              descriptionEditorRef
                            }
                            className="pms-description-editor-content"
                            contentEditable
                            suppressContentEditableWarning
                            data-placeholder="Digite a descrição do produto..."
                            onInput={
                              handleDescriptionInput
                            }
                          />


                          <div className="pms-description-counter">

                            {descriptionLength}/
                            {DESCRIPTION_MAX_LENGTH}

                          </div>

                        </div>

                      </div>


                      <div className="pms-form-group">

                        <label className="pms-label">
                          Status
                        </label>


                        <div className="pms-status-btns">

                          <button
                            className={`pms-status-btn ${editedProduct.status ===
                              "ativos"
                              ? "active"
                              : ""
                              }`}
                            onClick={() =>
                              handleStatusChange(
                                "ativos"
                              )
                            }
                          >
                            Ativo
                          </button>


                          <button
                            className={`pms-status-btn ${editedProduct.status ===
                              "arquivados"
                              ? "active"
                              : ""
                              }`}
                            onClick={() =>
                              handleStatusChange(
                                "arquivados"
                              )
                            }
                          >
                            Arquivado
                          </button>

                        </div>

                      </div>

                    </div>


                    <div className="pms-section">

                      <h3 className="pms-section-title">
                        Detalhes do Produto
                      </h3>


                      <div className="adm_products-modal-input-group">

                        <label htmlFor="input1">
                          Preço
                        </label>

                        <input
                          type="text"
                          name="value"
                          value={
                            editedProduct.value || ""
                          }
                          onChange={
                            handleInputChange
                          }
                          className="adm_products-modal-input"
                        />

                        {isSubscription && (
                          <span className="pms-field-hint">
                            É o valor cobrado a cada ciclo da
                            mensalidade.
                          </span>
                        )}

                      </div>


                      <div className="adm_products-modal-input-group">

                        <label className="pms-label">
                          Duração
                        </label>

                        <div className="adm_products-modal-input">

                          {formatDuration(
                            editedProduct.duration
                          )}

                        </div>

                      </div>


                      <div className="adm_products-modal-input-group">

                        <label htmlFor="promotional-price">
                          Preço promocional
                          <span className="pms-label-optional">
                            opcional
                          </span>
                        </label>

                        <input
                          id="promotional-price"
                          type="text"
                          name="discountedPrice"
                          value={
                            editedProduct.discountedPrice || ""
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Deixe vazio para não ter promoção"
                          className={`adm_products-modal-input ${promotionError ? "has-error" : ""
                            }`}
                        />

                        {promotionError ? (

                          <span className="pms-field-error">
                            {promotionError}
                          </span>

                        ) : promotion ? (

                          <span className="pms-promotion-preview">

                            <s>{promotion.normalLabel}</s>

                            <strong>
                              {promotion.promocionalLabel}
                            </strong>

                            <span className="pms-promotion-badge">
                              -{promotion.percentualLabel}
                            </span>

                          </span>

                        ) : (

                          <span className="pms-field-hint">
                            A porcentagem é calculada sozinha a
                            partir dos dois preços.
                          </span>

                        )}

                      </div>

                    </div>


                    {/* ======================================================
                        PLANO DE MENSALIDADE
                        Só aparece para produtos de assinatura.
                    ====================================================== */}

                    {isSubscription && monthlyPlan && (

                      <div className="pms-section pms-plan-section">

                        <h3 className="pms-section-title">
                          Plano de mensalidade
                        </h3>


                        {/* RESUMO */}

                        <div className="pms-plan-summary">

                          <div className="pms-plan-summary-icon">
                            <Icon icon="solar:refresh-circle-linear" />
                          </div>

                          <div className="pms-plan-summary-info">

                            <span className="pms-plan-summary-badge">
                              Assinatura recorrente
                            </span>

                            <strong>
                              {editedProduct.value || "—"}

                              <em>
                                {getPlanPriceSuffix(monthlyPlan)}
                              </em>
                            </strong>

                            <p>
                              {getPlanSessionsLabel(monthlyPlan)}
                            </p>

                          </div>

                        </div>


                        {/* CICLO DE COBRANÇA */}

                        <div className="adm-monthly-section">

                          <span className="adm-monthly-section-label">
                            Ciclo de cobrança
                          </span>

                          <div className="adm-monthly-cycle-options">

                            {BILLING_CYCLES.map((cycle) => (

                              <button
                                key={cycle.id}
                                type="button"
                                className={`adm-monthly-cycle-option ${monthlyPlan.billingCycle === cycle.id
                                  ? "selected"
                                  : ""
                                  }`}
                                onClick={() =>
                                  updateMonthlyPlan({
                                    billingCycle: cycle.id,
                                    billingCycleLabel: cycle.label
                                  })
                                }
                              >
                                {cycle.label}
                              </button>

                            ))}

                          </div>

                        </div>


                        {/* BENEFÍCIOS INCLUSOS */}

                        <div className="adm-monthly-section">

                          <span className="adm-monthly-section-label">
                            Benefícios inclusos por ciclo
                          </span>

                          <div className="adm-monthly-settings-list">

                            <div className="adm-monthly-setting-row">

                              <label
                                className="adm-monthly-setting-info"
                                htmlFor="pms-plan-unlimited-toggle"
                              >
                                <h4>Acesso ilimitado</h4>
                                <p>Sem limite de atendimentos no ciclo</p>
                              </label>

                              <div className="adm_admin_config-toggle-switch">

                                <input
                                  className="adm_admin_config-toggle-input"
                                  id="pms-plan-unlimited-toggle"
                                  type="checkbox"
                                  checked={
                                    monthlyPlan.unlimitedSessions !== false
                                  }
                                  onChange={(e) =>
                                    updateMonthlyPlan({
                                      unlimitedSessions:
                                        e.target.checked,
                                      sessionsPerCycle:
                                        e.target.checked
                                          ? null
                                          : (monthlyPlan.sessionsPerCycle || 0)
                                    })
                                  }
                                />

                                <label
                                  className="adm_admin_config-toggle-label"
                                  htmlFor="pms-plan-unlimited-toggle"
                                />

                              </div>

                            </div>


                            <div className="adm-monthly-setting-row">

                              <div className="adm-monthly-setting-info">
                                <h4>Sessões incluídas</h4>
                                <p>Quantidade de atendimentos por ciclo</p>
                              </div>

                              {monthlyPlan.unlimitedSessions !== false ? (

                                <span className="adm-monthly-setting-badge">
                                  Ilimitado
                                </span>

                              ) : (

                                <div className="adm-monthly-setting-input">

                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={
                                      monthlyPlan.sessionsPerCycle ?? ""
                                    }
                                    onChange={(e) =>
                                      handlePlanNumberChange(
                                        "sessionsPerCycle",
                                        e.target.value
                                      )
                                    }
                                  />

                                  <span>sessões</span>

                                </div>

                              )}

                            </div>

                          </div>

                        </div>


                        {/* REGRAS DA ASSINATURA */}

                        <div className="adm-monthly-section">

                          <span className="adm-monthly-section-label">
                            Regras da assinatura
                          </span>

                          <div className="adm-monthly-settings-list">

                            <div className="adm-monthly-setting-row">

                              <label
                                className="adm-monthly-setting-info"
                                htmlFor="pms-plan-autorenew-toggle"
                              >
                                <h4>Renovação automática</h4>
                                <p>Cobra o cliente de novo a cada ciclo</p>
                              </label>

                              <div className="adm_admin_config-toggle-switch">

                                <input
                                  className="adm_admin_config-toggle-input"
                                  id="pms-plan-autorenew-toggle"
                                  type="checkbox"
                                  checked={
                                    monthlyPlan.autoRenew !== false
                                  }
                                  onChange={(e) =>
                                    updateMonthlyPlan({
                                      autoRenew: e.target.checked
                                    })
                                  }
                                />

                                <label
                                  className="adm_admin_config-toggle-label"
                                  htmlFor="pms-plan-autorenew-toggle"
                                />

                              </div>

                            </div>


                            <div className="adm-monthly-setting-row">

                              <div className="adm-monthly-setting-info">
                                <h4>Teste gratuito</h4>
                                <p>Dias grátis antes da primeira cobrança</p>
                              </div>

                              <div className="adm-monthly-setting-input">

                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={monthlyPlan.trialDays ?? 0}
                                  onChange={(e) =>
                                    handlePlanNumberChange(
                                      "trialDays",
                                      e.target.value
                                    )
                                  }
                                />

                                <span>dias</span>

                              </div>

                            </div>


                            <div className="adm-monthly-setting-row">

                              <div className="adm-monthly-setting-info">
                                <h4>Permanência mínima</h4>
                                <p>Tempo mínimo de fidelidade do cliente</p>
                              </div>

                              <div className="adm-monthly-setting-input">

                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={monthlyPlan.loyaltyMonths ?? 0}
                                  onChange={(e) =>
                                    handlePlanNumberChange(
                                      "loyaltyMonths",
                                      e.target.value
                                    )
                                  }
                                />

                                <span>meses</span>

                              </div>

                            </div>


                            <div className="adm-monthly-setting-row">

                              <div className="adm-monthly-setting-info">
                                <h4>Aviso de cancelamento</h4>
                                <p>Antecedência para cancelar sem multa</p>
                              </div>

                              <div className="adm-monthly-setting-input">

                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={
                                    monthlyPlan.cancellationNoticeDays ?? 0
                                  }
                                  onChange={(e) =>
                                    handlePlanNumberChange(
                                      "cancellationNoticeDays",
                                      e.target.value
                                    )
                                  }
                                />

                                <span>dias</span>

                              </div>

                            </div>

                          </div>

                        </div>

                      </div>

                    )}


                    <div className="pms-section">

                      <h3 className="pms-section-title">
                        Categorias
                      </h3>


                      {editedProduct.categories?.length > 0 ? (

                        <div className="pms-categories">

                          {editedProduct.categories.map(
                            (
                              category,
                              index
                            ) => (

                              <span
                                key={index}
                                className="pms-category-tag"
                              >
                                {category}
                              </span>

                            )
                          )}

                        </div>

                      ) : (

                        <p>
                          Nenhuma categoria definida
                        </p>

                      )}

                    </div>

                  </div>

                )}


                {/* ======================================================
                    IMAGENS
                ====================================================== */}

                {activeTab === "images" && (

                  <div className="pms-content">

                    <h3 className="pms-section-title">
                      Imagens do Produto
                    </h3>

                    <div className="pms-images-grid">

                      {carouselItems.map(
                        (
                          item,
                          index
                        ) => (

                          <div
                            key={item.id}
                            className={`pms-image-item ${isAddingItem &&
                              index === newItemIndex
                              ? "scale-up-item"
                              : ""
                              } ${index ===
                                removingItemIndex
                                ? "scale-down-item"
                                : ""
                              }`}
                            onClick={() => {

                              const input =
                                document.getElementById(
                                  `file-input-${index}`
                                );

                              if (input) {
                                input.click();
                              }

                            }}
                          >

                            <input
                              id={`file-input-${index}`}
                              type="file"
                              accept="image/*"
                              style={{
                                display: "none"
                              }}
                              onChange={(e) =>
                                handleImageUpload(
                                  e,
                                  index
                                )
                              }
                            />


                            {item.image ? (

                              <>

                                <img
                                  src={item.image}
                                  alt={`Produto ${index + 1}`}
                                  className="pms-image"
                                />


                                <button
                                  type="button"
                                  className="pms-remove-image"
                                  onClick={(e) => {

                                    e.stopPropagation();

                                    handleRemoveItem(
                                      index
                                    );

                                  }}
                                >

                                  <Icon
                                    icon="mdi:trash"
                                  />

                                </button>

                              </>

                            ) : (

                              <div className="pms-image-placeholder">

                                <Icon
                                  icon="material-symbols:upload-rounded"
                                />

                                <span>
                                  Adicionar Imagem
                                </span>

                              </div>

                            )}

                          </div>

                        )
                      )}


                      {carouselItems.length <
                        MAX_IMAGES && (

                          <div
                            className="pms-image-item add-button"
                            onClick={
                              handleAddItem
                            }
                          >

                            <Icon icon="mdi:plus" />

                          </div>

                        )}

                    </div>


                    <div className="pms-add-images-info">

                      <p>
                        Máximo de {MAX_IMAGES} imagens
                      </p>

                    </div>

                  </div>

                )}


                {/* ======================================================
                    CONFIGURAÇÕES
                ====================================================== */}

                {activeTab === "settings" && (

                  <div className="pms-content">

                    {/* PRIVACIDADE */}

                    <div className="pms-section">

                      <h3 className="pms-section-title">
                        Configurações de Privacidade
                      </h3>


                      <div className="pms-setting-item pms-toggle-container">

                        <div>

                          <label className="pms-label">
                            Produto Privado
                          </label>

                          <p>
                            Deixe este produto visível
                            apenas para usuários
                            administradores
                          </p>

                        </div>


                        <label className="pms-toggle">

                          <input
                            type="checkbox"
                            checked={
                              editedProduct.settings?.privacy ||
                              false
                            }
                            onChange={(e) =>
                              setEditedProduct(
                                prev => ({

                                  ...prev,

                                  settings: {

                                    ...prev.settings,

                                    privacy:
                                      e.target.checked

                                  }

                                })
                              )
                            }
                          />

                          <span className="pms-toggle-slider"></span>

                        </label>

                      </div>


                      <div className="pms-setting-item pms-toggle-container">

                        <div>

                          <label className="pms-label">
                            Notificações
                          </label>

                          <p>
                            Enviar avisos para
                            clientes e administradores
                          </p>

                        </div>


                        <label className="pms-toggle">

                          <input
                            type="checkbox"
                            checked={
                              editedProduct.settings?.notifications ??
                              true
                            }
                            onChange={(e) =>
                              setEditedProduct(
                                prev => ({

                                  ...prev,

                                  settings: {

                                    ...prev.settings,

                                    notifications:
                                      e.target.checked

                                  }

                                })
                              )
                            }
                          />

                          <span className="pms-toggle-slider"></span>

                        </label>

                      </div>

                    </div>


                    {/* AGENDAMENTO */}

                    <div className="pms-section">

                      <h3 className="pms-section-title">
                        Configurações de Agendamento
                      </h3>


                      {/* BOOKING ADVANCE */}

                      <div className="pms-setting-item">

                        <label className="pms-label">
                          Antecedência para agendamento
                        </label>


                        {editingAdvance ===
                          "bookingAdvance" ? (

                          <div className="pms-advance-editor">

                            <div className="pms-advance-field">

                              <span>
                                Dias
                              </span>

                              <input
                                type="number"
                                min="0"
                                value={
                                  editedProduct
                                    .bookingAdvance
                                    ?.days ?? ""
                                }
                                onChange={(e) =>
                                  handleAdvanceChange(
                                    "bookingAdvance",
                                    "days",
                                    e.target.value
                                  )
                                }
                              />

                            </div>


                            <div className="pms-advance-field">

                              <span>
                                Horas
                              </span>

                              <input
                                type="number"
                                min="0"
                                max="23"
                                value={
                                  editedProduct
                                    .bookingAdvance
                                    ?.hours ?? ""
                                }
                                onChange={(e) =>
                                  handleAdvanceChange(
                                    "bookingAdvance",
                                    "hours",
                                    e.target.value
                                  )
                                }
                              />

                            </div>


                            <div className="pms-advance-field">

                              <span>
                                Minutos
                              </span>

                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={
                                  editedProduct
                                    .bookingAdvance
                                    ?.minutes ?? ""
                                }
                                onChange={(e) =>
                                  handleAdvanceChange(
                                    "bookingAdvance",
                                    "minutes",
                                    e.target.value
                                  )
                                }
                              />

                            </div>


                            <button
                              type="button"
                              className="pms-edit-setting"
                              onClick={() =>
                                finishAdvanceEdit(
                                  "bookingAdvance"
                                )
                              }
                            >
                              Concluir
                            </button>

                          </div>

                        ) : (

                          <>

                            <div className="pms-setting-value">

                              {editedProduct.bookingAdvance

                                ? `${editedProduct.bookingAdvance.days || 0}d ${editedProduct.bookingAdvance.hours || 0}h ${editedProduct.bookingAdvance.minutes || 0}m`

                                : "Não definido"}

                            </div>


                            <button
                              type="button"
                              className="pms-edit-setting"
                              onClick={() =>
                                setEditingAdvance(
                                  "bookingAdvance"
                                )
                              }
                            >
                              Editar
                            </button>

                          </>

                        )}

                      </div>


                      {/* CANCELLATION ADVANCE */}

                      <div className="pms-setting-item">

                        <label className="pms-label">
                          Antecedência para cancelamento
                        </label>


                        {editingAdvance ===
                          "cancellationAdvance" ? (

                          <div className="pms-advance-editor">

                            <div className="pms-advance-field">

                              <span>
                                Dias
                              </span>

                              <input
                                type="number"
                                min="0"
                                value={
                                  editedProduct
                                    .cancellationAdvance
                                    ?.days ?? ""
                                }
                                onChange={(e) =>
                                  handleAdvanceChange(
                                    "cancellationAdvance",
                                    "days",
                                    e.target.value
                                  )
                                }
                              />

                            </div>


                            <div className="pms-advance-field">

                              <span>
                                Horas
                              </span>

                              <input
                                type="number"
                                min="0"
                                max="23"
                                value={
                                  editedProduct
                                    .cancellationAdvance
                                    ?.hours ?? ""
                                }
                                onChange={(e) =>
                                  handleAdvanceChange(
                                    "cancellationAdvance",
                                    "hours",
                                    e.target.value
                                  )
                                }
                              />

                            </div>


                            <div className="pms-advance-field">

                              <span>
                                Minutos
                              </span>

                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={
                                  editedProduct
                                    .cancellationAdvance
                                    ?.minutes ?? ""
                                }
                                onChange={(e) =>
                                  handleAdvanceChange(
                                    "cancellationAdvance",
                                    "minutes",
                                    e.target.value
                                  )
                                }
                              />

                            </div>


                            <button
                              type="button"
                              className="pms-edit-setting"
                              onClick={() =>
                                finishAdvanceEdit(
                                  "cancellationAdvance"
                                )
                              }
                            >
                              Concluir
                            </button>

                          </div>

                        ) : (

                          <>

                            <div className="pms-setting-value">

                              {editedProduct.cancellationAdvance

                                ? `${editedProduct.cancellationAdvance.days || 0}d ${editedProduct.cancellationAdvance.hours || 0}h ${editedProduct.cancellationAdvance.minutes || 0}m`

                                : "Não definido"}

                            </div>


                            <button
                              type="button"
                              className="pms-edit-setting"
                              onClick={() =>
                                setEditingAdvance(
                                  "cancellationAdvance"
                                )
                              }
                            >
                              Editar
                            </button>

                          </>

                        )}

                      </div>


                      {/* PREPAYMENT */}

                      <div className="pms-setting-item pms-toggle-container">

                        <div>

                          <label className="pms-label">
                            Pagamento antecipado
                          </label>

                          <p>
                            Exige pagamento antes do agendamento
                          </p>

                        </div>


                        <label className="pms-toggle">

                          <input
                            type="checkbox"
                            checked={
                              editedProduct.settings?.prepayment ||
                              false
                            }
                            onChange={(e) =>
                              setEditedProduct(
                                prev => ({

                                  ...prev,

                                  settings: {

                                    ...prev.settings,

                                    prepayment:
                                      e.target.checked

                                  }

                                })
                              )
                            }
                          />

                          <span className="pms-toggle-slider"></span>

                        </label>

                      </div>


                      {/* RESCHEDULING */}

                      <div className="pms-setting-item pms-toggle-container">

                        <div>

                          <label className="pms-label">
                            Permitir reagendamento
                          </label>

                          <p>
                            Permite alterar data/hora
                            após confirmação
                          </p>

                        </div>


                        <label className="pms-toggle">

                          <input
                            type="checkbox"
                            checked={
                              editedProduct.settings?.rescheduling ??
                              true
                            }
                            onChange={(e) =>
                              setEditedProduct(
                                prev => ({

                                  ...prev,

                                  settings: {

                                    ...prev.settings,

                                    rescheduling:
                                      e.target.checked

                                  }

                                })
                              )
                            }
                          />

                          <span className="pms-toggle-slider"></span>

                        </label>

                      </div>

                    </div>


                    {/* AVANÇADO */}

                    <div className="pms-section">

                      <h3 className="pms-section-title">
                        Configurações Avançadas
                      </h3>


                      <div className="pms-setting-item">

                        <label className="pms-label">
                          Preço Dinâmico
                        </label>

                        <div className="pms-setting-value"></div>

                        <button
                          type="button"
                          className="pms-edit-setting"
                        >
                          Editar
                        </button>

                      </div>


                      <div className="pms-setting-item">

                        <label className="pms-label">
                          Taxas Extras
                        </label>

                        <div className="pms-setting-value"></div>

                        <button
                          type="button"
                          className="pms-edit-setting"
                        >
                          Editar
                        </button>

                      </div>

                    </div>


                    {/* USUÁRIOS RELACIONADOS */}

                    <div className="pms-section">

                      <h3 className="pms-section-title">
                        Usuários Relacionados
                      </h3>


                      {editedProduct.relatedUsers?.length > 0 ? (

                        <div className="pms-users-list">

                          {editedProduct.relatedUsers.map(
                            (
                              user,
                              index
                            ) => (

                              <div
                                key={index}
                                className="pms-user-item"
                              >

                                <div className="pms-user-avatar">

                                  {user?.name?.[0] ||
                                    "?"}

                                </div>


                                <div className="pms-user-info">

                                  <h4>
                                    {user?.name ||
                                      "Sem nome"}
                                  </h4>

                                  <p>
                                    {user?.role ||
                                      "Sem cargo"}
                                  </p>

                                </div>


                                <button
                                  type="button"
                                  className="pms-remove-user"
                                  onClick={(e) => {

                                    e.stopPropagation();

                                    handleRemoveRelatedUser(
                                      user.id
                                    );

                                  }}
                                >

                                  <Icon
                                    icon="mdi:trash"
                                  />

                                </button>

                              </div>

                            )
                          )}

                        </div>

                      ) : (

                        <p>
                          Nenhum usuário relacionado
                        </p>

                      )}


                      <button
                        type="button"
                        className="pms-add-user"
                        onClick={() =>
                          setIsAddUserOpen(
                            true
                          )
                        }
                      >

                        <Icon icon="mdi:plus" />

                        Adicionar Usuário

                      </button>

                    </div>

                  </div>

                )}

              </>

            )}

        </div>


        {/* O motivo de o salvamento não ter acontecido fica
            junto do botão: é onde a pessoa está olhando
            quando clica e nada muda. */}
        {saveError && (

          <div className="pms-save-error" role="alert">
            <Icon icon="lucide:alert-triangle" />
            <span>{saveError}</span>
          </div>

        )}


        {/* ACTIONS */}

        <div className="pms-actions">

          <button
            type="button"
            className="pms-cancel"
            onClick={handleClose}
            disabled={isSaving}
          >
            Desfazer Alterações
          </button>


          <button
            type="button"
            className="pms-save"
            onClick={handleSave}
            disabled={isSaving}
          >

            {isSaving
              ? "Salvando..."
              : "Salvar Alterações"}

          </button>

        </div>


        {/* ==============================================================
            ADD USER MODAL
        ============================================================== */}

        <Modal
          open={isAddUserOpen}
          onClose={() => setIsAddUserOpen(false)}
          overlayClassName="pms-add-user-overlay"
          className="pms-add-user-modal"
          label="Adicionar usuário"
        >

                <h3>
                  Adicionar usuário
                </h3>


                <input
                  type="text"
                  placeholder="Pesquisar membro..."
                  value={userSearch}
                  onChange={(e) =>
                    setUserSearch(
                      e.target.value
                    )
                  }
                />


                <div className="pms-add-user-list">

                  {filteredUsers.map(
                    user => (

                      <div
                        key={user.id}
                        className="pms-add-user-item"
                        onClick={() =>
                          handleAddRelatedUser(
                            user
                          )
                        }
                      >

                        <div className="pms-user-avatar">

                          {user.name?.charAt(0) ||
                            "?"}

                        </div>


                        <div className="pms-user-info">

                          <h4>
                            {user.name}
                          </h4>

                          <p>
                            {user.role}
                          </p>

                        </div>


                        <Icon
                          icon="mingcute:add-line"
                          className="icon"
                        />

                      </div>

                    )
                  )}

                </div>

        </Modal>

      </div>

    </div>

  );
};


export default ProductManagementSlider;