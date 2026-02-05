const express = require('express');
const app = express();
const userModel = require('./models/user');
const postModel = require('./models/post');
const cookieParser = require('cookie-parser');
const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');
const { render } = require('ejs');

app.set('view engine',"ejs");
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {

    let loggedIn = false;

    if(req.cookies.token){
        loggedIn = true;
    }

    res.render("index", { loggedIn });

});

app.post('/register', async (req, res) => {
  let { username, name, age, email, password } = req.body;

  let mailExists = await userModel.findOne({ email: email});

  if (mailExists) {
    return res.status(500).send('Email already registered. Please use a different email.');
  }
  bcrypt.genSalt(10,async (err,salt)=>{
    bcrypt.hash(password,salt, async (err,hash)=>{
    let user = await userModel.create({
            username,
            name,
            age,
            email,
            password:hash
        });
        let token = jwt.sign({email:email,userid:user._id},'secret');
        res.cookie('token',token);
        res.redirect('/profile');


    })
  })


});

app.get('/profile', isloggedin, async (req, res) => {
  let user = await userModel
    .findOne({ email: req.user.email })
    .populate('posts');

  res.render('profile', { user });


   
});

app.post('/post',isloggedin, async (req, res) => {
  let user = await userModel.findOne({email:req.user.email});
  let {content}=req.body;

  let post=await postModel.create({
    user:user._id,
    content:content
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect('/profile');

});  
 
app.get('/login', async (req, res) => {
  res.render('login');
});

app.post('/login', async (req,res)=>{
  let {email,password}=req.body;
  let user = await userModel.findOne({email:email})
  if(!user){
    return res.status(500).send('User Not Found');
  }

  bcrypt.compare(password,user.password,(err,result)=>{
    if(result){
      let token = jwt.sign({email:email,userid:user._id},'secret');
      res.cookie('token',token);
      res.redirect('/profile');

    }else{
      res.status(500).send('Invalid Password'); 

    }
  })


})

app.get('/logout',(req,res)=>{
  res.cookie('token',"");
  
   res.redirect("/")
})


app.get('/like/:id',isloggedin,async (req,res)=>{
  let post=await postModel.findOne({_id:req.params.id}).populate('user');

  if(post.likes.indexOf(req.user.userid)===-1){
    post.likes.push(req.user.userid);
  }
  else {
    post.likes.splice(post.likes.indexOf(req.user.userid),1);
  }

  await post.save();
  res.redirect('/profile');
})


app.get('/edit/:id',isloggedin,async (req,res)=>{
  let post =await postModel.findOne({_id:req.params.id}).populate('user');

  res.render('edit',{post}
  );
})


app.post('/edit/:id',isloggedin,async (req,res)=>{
  let post =await postModel.findOne({_id:req.params.id}).populate('user');

  post.content=req.body.content;
  await post.save();
  res.redirect('/profile');
})
function isloggedin(req,res,next){
  let token = req.cookies.token;
  if(token===""){
    return res.redirect('/login');
  } else {
    jwt.verify(token,'secret', (err,decoded)=>{ 
      if(err){
        return res.redirect('/login');
      } else {
        req.user =  decoded;
        next();
      }
    });
  }
}


app.listen(3000);