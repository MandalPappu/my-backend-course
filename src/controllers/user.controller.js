import { asyncHandler } from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"

    const generateAccessAndRefreshToken = async (userId) => {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}
    }

    const registerUser = asyncHandler( async (req, res) => {
   //get user details from frontend
   //validation - not empty
   //check user already exist - username, email
   //check for image and check for avatar
   //upload them on cloudinary - avatar
   //create user object - create entry in db
   //remove password and refreshToken field from response
   //check for user creation
   //return res

    const {fullName, email, username, password} = req.body;

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "all fields are required")
    }

   const existedUser = await User.findOne(
        {$or : [{username}, {email}]}
    )
    console.log(email);
    if (existedUser) {
        throw new ApiError(409, "the user is already exists")
    }

    let avatarLocalPath;
    if (
        req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0
    ){
        avatarLocalPath = req.files.avatar[0].path
    }
    console.log(avatarLocalPath);
    let coverImageLocalPath;
    if (
        req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0
    ) {
        coverImageLocalPath =  req.files.coverImage[0].path
    }
    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar) {
        throw new ApiError(400, "avatar file is required")
    }

    const user = await User.create(
        {
            fullName,
            email,
            avatar : avatar.url,
            coverImage: coverImage?.url || "",
            password,
            username: username.toLowerCase()
        }
    )
    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if (!createdUser) {
        throw new ApiError(500, "something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "the user registered successfully")
    )

})

const loginUser = asyncHandler( async (req, res) => {
    //req.body - user data
    //username or email
    //find the user
    //password check
    //access and refreshToken
    //send cookie
    const {username, email, password} = req.body

    if (!username || !email) {
        throw new ApiError(400, "username or email is required")
    }
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(400, "user does not exist")
    }

    const isPasswordValidate = await user.isPasswordCorrect(password)

    if (!isPasswordValidate) {
        throw new ApiError(400, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findOne(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200,
            {
                user: loggedInUser, accessToken, refreshToken
            }, 
            "user is log in successfully"
            )
    )

})

const logoutUser = asyncHandler( async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
        )

        const options = {
            httpOnly: true,
            secure: true
        }
        res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User log out successfully")
        )
})



export  { 
    registerUser,
    loginUser,
    logoutUser,
} 