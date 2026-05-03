// @ts-ignore - Bỏ qua cảnh báo module Deno jsr trong dự án Node.js
import { createClient } from "jsr:@supabase/supabase-js@2";

// @ts-ignore - Khai báo Deno để không báo lỗi Cannot find name Deno
declare const Deno: any;

interface SePayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  code: string;
  content: string; // e.g., "NGUYEN VAN A CHUYEN TIEN SEVQR tuanb"
  transferType: string;
  transferAmount: number;
  accumulatedBalance: number;
  referenceCode: string;
  description: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: SePayWebhookPayload = await req.json();
    console.log("Received SePay Webhook Payload:", JSON.stringify(payload));

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // Ghi log raw payload vào DB để dễ debug
    await supabase.from("webhook_logs").insert({
      payload: payload
    });

    // 1. Chỉ xử lý tiền vào
    if (payload.transferType?.toLowerCase() !== "in") {
      return new Response(JSON.stringify({ success: true, message: "Not an incoming transaction" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Phân tích nội dung chuyển khoản: Quét từ để tìm user
    const contentStr = payload.content || "";
    // Tách chuỗi thành mảng các từ, loại bỏ khoảng trắng dư thừa
    const words = contentStr.trim().split(/\s+/);
    
    // Lấy danh sách profiles để đối soát
    const { data: allProfiles, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email, coin");

    if (fetchError || !allProfiles) {
       throw new Error("Could not fetch profiles");
    }

    let matchedUser = null;
    let identifiedWord = "";

    // 3. Duyệt danh sách từ từ cuối lên đầu (ưu tiên từ cuối cùng)
    // Cách tiếp cận này giúp xử lý được các trường hợp MoMo chèn thêm số điện thoại/mã giao dịch sau prefix ND
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i].toLowerCase();
      // Làm sạch từ để so sánh (chỉ giữ lại chữ và số)
      const cleanWord = word.replace(/[^a-z0-9]/g, "");
      
      if (cleanWord.length < 3) continue; // Bỏ qua các từ quá ngắn để tránh nhận diện sai

      // Thử khớp chính xác với email prefix (ví dụ: phantuan.bk01)
      matchedUser = allProfiles.find((p: any) => p.email && p.email.toLowerCase().startsWith(word + "@"));
      
      // Nếu không khớp chính xác, thử khớp sau khi làm sạch (ví dụ: phantuanbk01)
      if (!matchedUser) {
        matchedUser = allProfiles.find((p: any) => {
          if (!p.email) return false;
          const pPrefix = p.email.split("@")[0].replace(/[^a-z0-9]/g, "").toLowerCase();
          return pPrefix === cleanWord;
        });
      }

      if (matchedUser) {
        identifiedWord = word;
        console.log(`Found matching user: ${matchedUser.email} from word: "${word}"`);
        break;
      }
    }

    if (!matchedUser) {
      console.warn("Could not find user identifier in content:", contentStr);
      await supabase.from("webhook_logs").insert({ payload, error: "User not found for any word in content" });
      return new Response(JSON.stringify({ success: false, message: `Could not find matching user in content: ${contentStr}` }), { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = matchedUser as any;

    // 4. Tính số xu (1,000đ = 1 Xu)
    const coinToAdd = Math.floor(payload.transferAmount / 1000);
    if (coinToAdd <= 0) {
      return new Response(JSON.stringify({ success: true, message: "Amount too small" }));
    }

    // 5. Gọi RPC để xử lý nạp tiền nguyên tử
    const { data: rpcData, error: rpcError } = await supabase.rpc("handle_coin_recharge", {
      p_user_id: user.id,
      p_amount: coinToAdd,
      p_bank_ref: payload.referenceCode,
      p_description: `Nạp tiền qua SePay (GD: ${payload.referenceCode})`,
      p_raw_data: payload
    });

    if (rpcError) {
      console.error("RPC Error:", rpcError);
      throw new Error(rpcError.message);
    }

    if (rpcData && rpcData.success === false) {
      console.warn("Recharge logic failed:", rpcData.error);
      return new Response(JSON.stringify({ success: false, message: rpcData.error }), { status: 400 });
    }

    console.log(`Success: Added ${coinToAdd} coins to ${user.email}. New balance: ${rpcData.new_balance}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully added ${coinToAdd} coins to ${user.email}`,
      new_balance: rpcData.new_balance
    }));

  } catch (error) {
    console.error("Webhook Error:", error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Response(JSON.stringify({ success: false, message: (error as any).message }), { status: 500 });
  }
});
